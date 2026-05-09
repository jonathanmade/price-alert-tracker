from datetime import datetime, timezone
from celery import shared_task
from celery.utils.log import get_task_logger
from django.conf import settings
from supabase import create_client

from .scraper import scrape_price
from apps.alerts.notifications import send_price_alert

logger = get_task_logger(__name__)


def _get_supabase():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@shared_task(name="products.check_all_prices")
def check_all_prices():
    supabase = _get_supabase()

    # Obtener todas las alertas activas con su producto y perfil de usuario
    result = (
        supabase.table("alerts")
        .select("*, products(*), profiles(email)")
        .eq("status", "active")
        .execute()
    )

    alerts = result.data or []
    logger.info(f"Revisando precios para {len(alerts)} alertas activas")

    for alert in alerts:
        _check_single_alert.delay(alert["id"])


@shared_task(name="products.check_single_alert")
def _check_single_alert(alert_id: str):
    supabase = _get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Cargar alerta con producto y email del usuario
    result = (
        supabase.table("alerts")
        .select("*, products(*), profiles(email)")
        .eq("id", alert_id)
        .single()
        .execute()
    )
    alert = result.data
    if not alert:
        return

    product = alert["products"]
    url = product["url"]

    current_price = scrape_price(url)

    if current_price is None:
        logger.warning(f"No se pudo obtener precio para {url}")
        return

    # Actualizar precio actual y timestamp en el producto
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

    logger.info(f"{product['name']}: {current_price}€ (objetivo: {alert['target_price']}€)")

    # Disparar alerta si el precio es igual o menor al objetivo
    if current_price <= float(alert["target_price"]):
        email = alert["profiles"]["email"]

        send_price_alert(
            to_email=email,
            product_name=product["name"],
            product_url=url,
            current_price=current_price,
            target_price=float(alert["target_price"]),
        )

        supabase.table("alerts").update({
            "status": "triggered",
            "triggered_at": now,
        }).eq("id", alert_id).execute()

        logger.info(f"Alerta disparada para {email}: {product['name']} a {current_price}€")
