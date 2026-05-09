from datetime import datetime, timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.conf import settings
import json

from apps.users.supabase_auth import verify_supabase_token
from apps.products.scraper import scrape_price
from apps.alerts.notifications import send_price_alert
from supabase import create_client


def _get_supabase():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@csrf_exempt
@require_POST
def check_price_now(request):
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

    # Cargar alerta con producto y perfil
    result = (
        supabase.table("alerts")
        .select("*, products(*), profiles(email, credits)")
        .eq("id", alert_id)
        .single()
        .execute()
    )
    alert = result.data
    if not alert:
        return JsonResponse({"error": "Alerta no encontrada"}, status=404)

    user_id = alert["user_id"]
    product = alert["products"]
    profile = alert["profiles"]

    # Verificar créditos
    credits = profile.get("credits", 0)
    if credits <= 0:
        return JsonResponse({"error": "Sin créditos disponibles", "credits": 0}, status=402)

    # Scraping síncrono
    current_price = scrape_price(product["url"])
    if current_price is None:
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
        "current_price": current_price,
        "last_checked_at": now,
    }).eq("id", product["id"]).execute()

    # Guardar en historial
    supabase.table("price_history").insert({
        "product_id": product["id"],
        "price": current_price,
        "checked_at": now,
    }).execute()

    # Disparar alerta si el precio alcanza el objetivo
    triggered = False
    if current_price <= float(alert["target_price"]) and alert["status"] == "active":
        send_price_alert(
            to_email=profile["email"],
            product_name=product["name"],
            product_url=product["url"],
            current_price=current_price,
            target_price=float(alert["target_price"]),
        )
        supabase.table("alerts").update({
            "status": "triggered",
            "triggered_at": now,
        }).eq("id", alert_id).execute()
        triggered = True

    return JsonResponse({
        "price": current_price,
        "triggered": triggered,
        "credits_remaining": credits - 1,
    })
