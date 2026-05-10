from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.urls import path, include

from apps.alerts.views import check_price_now, scrape_metadata_view
from apps.catalog.sitemaps import CatalogSitemap, ProductSitemap
from apps.telegram_bot.views import (
    TelegramWebhookView,
    TelegramStatusView,
    TelegramLinkView,
    TelegramUnlinkView,
)
from apps.catalog.views import (
    AffiliateRedirectView,
    CatalogView,
    CategoryView,
    CouponsPublicView,
    ProductPublicView,
    robots_txt,
)

_sitemaps = {
    "products": ProductSitemap,
    "catalog":  CatalogSitemap,
}

urlpatterns = [
    path("admin/",   admin.site.urls),
    path("staff/",   include("apps.staff.urls")),

    # API
    path("api/check-price/",      check_price_now),
    path("api/scrape-metadata/",  scrape_metadata_view),

    # Afiliado
    path("go/<slug:product_slug>/<slug:marketplace_slug>/",
         AffiliateRedirectView.as_view(), name="affiliate_redirect"),

    # Comparador público
    path("cupones/",       CouponsPublicView.as_view(), name="coupons"),
    path("comparar/",                  CatalogView.as_view(),   name="catalog"),
    path("comparar/<slug:category_slug>/", CategoryView.as_view(), name="category"),
    path("producto/<slug:slug>/",      ProductPublicView.as_view(), name="product_detail"),

    # SEO
    path("sitemap.xml", sitemap, {"sitemaps": _sitemaps},
         name="django.contrib.sitemaps.views.sitemap"),
    path("robots.txt",  robots_txt, name="robots_txt"),

    # Telegram webhook (Telegram → Django)
    path("telegram/webhook/",    TelegramWebhookView.as_view(), name="telegram_webhook"),
    # Telegram API (React → Django)
    path("api/telegram/status/", TelegramStatusView.as_view(),  name="telegram_status"),
    path("api/telegram/link/",   TelegramLinkView.as_view(),    name="telegram_link"),
    path("api/telegram/unlink/", TelegramUnlinkView.as_view(),  name="telegram_unlink"),
]
