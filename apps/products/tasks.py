from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from celery import shared_task
from celery.utils.log import get_task_logger
from django.conf import settings
from supabase import create_client

from .scraper import scrape_price
from apps.alerts.notifications import send_price_alert

logger = get_task_logger(__name__)

_MADRID = ZoneInfo("Europe/Madrid")


def _get_supabase():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def _deduct_credit(supabase, user_id: str) -> bool:
    result = supabase.table("profiles").select("credits").eq("id", user_id).single().execute()
    credits = result.data.get("credits", 0) if result.data else 0
    if credits <= 0:
        return False
    supabase.table("profiles").update({"credits": credits - 1}).eq("id", user_id).execute()
    supabase.table("credit_transactions").insert({
        "user_id": user_id,
        "amount": -1,
        "reason": "price_check",
    }).execute()
    return True


@shared_task(name="products.check_all_prices")
def check_all_prices():
    supabase = _get_supabase()

    now = datetime.now(_MADRID)
    hour_str = now.strftime("%H:00:00")
    next_hour = (now.hour + 1) % 24
    next_hour_str = f"{next_hour:02d}:00:00"

    query = (
        supabase.table("alerts")
        .select("id")
        .eq("status", "active")
        .gte("check_time", hour_str)
    )
    # midnight wrap: don't add upper bound so we include 23:00:00
    if next_hour != 0:
        query = query.lt("check_time", next_hour_str)

    result = query.execute()
    alerts = result.data or []
    logger.info(f"Hora {hour_str}: {len(alerts)} alertas programadas")

    for alert in alerts:
        _check_single_alert.delay(alert["id"])


@shared_task(name="products.check_single_alert")
def _check_single_alert(alert_id: str):
    supabase = _get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("alerts")
        .select("*, products(*)")
        .eq("id", alert_id)
        .single()
        .execute()
    )
    alert = result.data
    if not alert:
        return

    user_id = alert["user_id"]
    product = alert["products"]

    profile_result = (
        supabase.table("profiles")
        .select("email, credits")
        .eq("id", user_id)
        .single()
        .execute()
    )
    profile = profile_result.data
    if not profile:
        logger.warning(f"Perfil no encontrado para user {user_id}")
        return

    if not _deduct_credit(supabase, user_id):
        logger.warning(f"Sin créditos para user {user_id}, alerta {alert_id} omitida")
        return

    current_price = scrape_price(product["url"])

    if current_price is None:
        logger.warning(f"No se pudo obtener precio para {product['url']}")
        supabase.table("profiles").update({
            "credits": profile.get("credits", 0)
        }).eq("id", user_id).execute()
        return

    supabase.table("products").update({
        "current_price": current_price,
        "last_checked_at": now,
    }).eq("id", product["id"]).execute()

    supabase.table("price_history").insert({
        "product_id": product["id"],
        "price": current_price,
        "checked_at": now,
    }).execute()

    logger.info(f"{product['name']}: {current_price}€ (objetivo: {alert['target_price']}€)")

    def _trigger(hit_url: str, hit_price: float):
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
        except Exception:
            pass
        supabase.table("alerts").update({
            "status": "triggered",
            "triggered_at": now,
        }).eq("id", alert_id).execute()
        logger.info(f"Alerta disparada: {product['name']} a {hit_price}€ → {profile['email']}")

    triggered = False
    if current_price <= float(alert["target_price"]):
        _trigger(product["url"], current_price)
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
        if not triggered and au_price <= float(alert["target_price"]):
            _trigger(au["url"], au_price)
            triggered = True
