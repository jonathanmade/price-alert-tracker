from datetime import datetime, timezone

from celery import shared_task
from celery.utils.log import get_task_logger
from django.conf import settings
from supabase import create_client

from apps.products.scraper import scrape_price

logger = get_task_logger(__name__)


def _get_supabase():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@shared_task(name="catalog.check_catalog_prices")
def check_catalog_prices():
    """
    Scrape todos los ProductURL activos de productos featured.
    Lanzar desde beat cada 6 horas.
    """
    from .models import ProductURL

    urls = (
        ProductURL.objects
        .filter(active=True, product__active=True, product__featured=True)
        .select_related("product", "marketplace")
    )

    total = urls.count()
    logger.info("catalog.check_catalog_prices: scrapeando %d URLs", total)

    for product_url in urls:
        _scrape_single_url.delay(product_url.id)

    logger.info("catalog.check_catalog_prices: %d tasks lanzados", total)


@shared_task(
    name="catalog.scrape_single_url",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
)
def _scrape_single_url(product_url_id: int):
    from .models import ProductURL

    try:
        product_url = ProductURL.objects.select_related("product").get(
            id=product_url_id, active=True
        )
    except ProductURL.DoesNotExist:
        logger.warning("ProductURL %d no encontrada o inactiva", product_url_id)
        return

    url = product_url.url
    product = product_url.product
    now = datetime.now(timezone.utc)

    current_price = scrape_price(url)

    if current_price is None:
        logger.warning("No se pudo obtener precio para %s (ProductURL %d)", url, product_url_id)
        return

    ProductURL.objects.filter(id=product_url_id).update(
        current_price=current_price,
        last_checked=now,
    )

    supabase = _get_supabase()
    supabase.table("catalog_price_history").insert({
        "product_url_id": product_url_id,
        "product_id":     product.id,
        "price":          float(current_price),
        "checked_at":     now.isoformat(),
    }).execute()

    logger.info("%s — %s: %.2f€", product.name, product_url.marketplace.name, current_price)
