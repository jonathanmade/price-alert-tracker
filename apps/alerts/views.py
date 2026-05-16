from datetime import datetime, timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.conf import settings
from django_ratelimit.decorators import ratelimit
import json
import jwt as pyjwt

from apps.users.supabase_auth import verify_supabase_token
from apps.products.scraper import scrape_price, scrape_metadata
from apps.alerts.notifications import send_price_alert
from supabase import create_client


def _get_supabase():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def _jwt_user_key(group, request):
    """Extrae el user_id del JWT como clave de rate limit (sin re-verificar firma)."""
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if auth.startswith("Bearer "):
        try:
            payload = pyjwt.decode(auth[7:], options={"verify_signature": False})
            return payload.get("sub", "anon")
        except Exception:
            pass
    return request.META.get("REMOTE_ADDR", "anon")


@csrf_exempt
@require_POST
@ratelimit(key=_jwt_user_key, rate="10/m", block=False)
def check_price_now(request):
    if getattr(request, "limited", False):
        return JsonResponse({"error": "Demasiadas peticiones. Espera un minuto."}, status=429)
    payload = verify_supabase_token(request)
    if not payload:
        return JsonResponse({"error": "No autorizado"}, status=401)

    try:
        body = json.loads(request.body)
        alert_id = body.get("alert_id")
    except ValueError:
        return JsonResponse({"error": "JSON inválido"}, status=400)

    if not alert_id:
        return JsonResponse({"error": "alert_id requerido"}, status=400)

    supabase = _get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Cargar alerta con producto
    result = (
        supabase.table("alerts")
        .select("*, products(*, scrape_ok_count, scrape_error_count)")
        .eq("id", alert_id)
        .single()
        .execute()
    )
    alert = result.data
    if not alert:
        return JsonResponse({"error": "Alerta no encontrada"}, status=404)

    user_id = alert["user_id"]
    product = alert["products"]

    # Cargar perfil por separado (no hay FK directa entre alerts y profiles)
    profile_result = (
        supabase.table("profiles")
        .select("email, credits")
        .eq("id", user_id)
        .single()
        .execute()
    )
    profile = profile_result.data
    if not profile:
        return JsonResponse({"error": "Perfil no encontrado"}, status=404)

    # Verificar créditos
    credits = profile.get("credits", 0)
    if credits <= 0:
        return JsonResponse({"error": "Sin créditos disponibles", "credits": 0}, status=402)

    # Scraping síncrono
    current_price = scrape_price(product["url"])
    if current_price is None:
        supabase.table("products").update({
            "last_scrape_status": "error",
            "last_scrape_error":  "No se pudo extraer el precio de la página",
            "last_checked_at":    now,
            "scrape_error_count": product.get("scrape_error_count", 0) + 1,
        }).eq("id", product["id"]).execute()
        return JsonResponse({"error": "No se pudo obtener el precio de esta URL"}, status=422)

    # Descontar crédito
    supabase.table("profiles").update({"credits": credits - 1}).eq("id", user_id).execute()
    supabase.table("credit_transactions").insert({
        "user_id": user_id,
        "amount": -1,
        "reason": "price_check",
    }).execute()

    # Actualizar precio del producto
    supabase.table("products").update({
        "current_price":      current_price,
        "last_checked_at":    now,
        "last_scrape_status": "ok",
        "last_scrape_error":  None,
        "scrape_ok_count":    product.get("scrape_ok_count", 0) + 1,
    }).eq("id", product["id"]).execute()

    # Guardar en historial
    supabase.table("price_history").insert({
        "product_id": product["id"],
        "price": current_price,
        "checked_at": now,
    }).execute()

    def _trigger_alert(hit_url: str, hit_price: float):
        send_price_alert(
            to_email=profile["email"],
            product_name=product["name"],
            product_url=hit_url,
            current_price=hit_price,
            target_price=float(alert["target_price"]),
        )
        try:
            from apps.telegram_bot.models import TelegramAccount
            from apps.telegram_bot.bot import send_alert as tg_send
            tg = TelegramAccount.objects.get(user_id=user_id, active=True)
            tg_send(tg.chat_id, product["name"], hit_url, hit_price, float(alert["target_price"]))
        except TelegramAccount.DoesNotExist:
            pass
        except Exception:
            import logging
            logging.getLogger(__name__).error("Error enviando Telegram en check_price_now", exc_info=True)
        supabase.table("alerts").update({
            "status": "triggered",
            "triggered_at": now,
        }).eq("id", alert_id).execute()

    # Comprobar precio principal
    triggered = False
    if current_price <= float(alert["target_price"]) and alert["status"] == "active":
        _trigger_alert(product["url"], current_price)
        triggered = True

    # Comprobar URLs adicionales (multi-marketplace)
    extra_urls = supabase.table("alert_urls").select("*").eq("alert_id", alert_id).execute().data or []
    for au in extra_urls:
        au_price = scrape_price(au["url"])
        if au_price is None:
            continue
        supabase.table("alert_urls").update({
            "current_price": au_price,
            "last_checked_at": now,
        }).eq("id", au["id"]).execute()
        if not triggered and au_price <= float(alert["target_price"]) and alert["status"] == "active":
            _trigger_alert(au["url"], au_price)
            triggered = True

    return JsonResponse({
        "price": current_price,
        "triggered": triggered,
        "credits_remaining": credits - 1,
    })


@csrf_exempt
@require_POST
@ratelimit(key="ip", rate="20/m", block=False)
def scrape_metadata_view(request):
    if getattr(request, "limited", False):
        return JsonResponse({"error": "Demasiadas peticiones. Espera un minuto."}, status=429)
    payload = verify_supabase_token(request)
    if not payload:
        return JsonResponse({"error": "No autorizado"}, status=401)

    try:
        body = json.loads(request.body)
        url = body.get("url", "").strip()
    except ValueError:
        return JsonResponse({"error": "JSON inválido"}, status=400)

    if not url:
        return JsonResponse({"error": "url requerida"}, status=400)

    data = scrape_metadata(url)
    return JsonResponse(data)


@csrf_exempt
@require_POST
def track_outbound_click(request):
    payload = verify_supabase_token(request)
    if not payload:
        return JsonResponse({"error": "No autorizado"}, status=401)

    try:
        body = json.loads(request.body)
        product_id = body.get("product_id", "").strip()
    except ValueError:
        return JsonResponse({"error": "JSON inválido"}, status=400)

    if not product_id:
        return JsonResponse({"error": "product_id requerido"}, status=400)

    supabase = _get_supabase()
    product = supabase.table("products").select("id, outbound_clicks").eq("id", product_id).single().execute().data
    if not product:
        return JsonResponse({"error": "Producto no encontrado"}, status=404)

    supabase.table("products").update({
        "outbound_clicks": product.get("outbound_clicks", 0) + 1,
    }).eq("id", product_id).execute()

    return JsonResponse({"ok": True})
