from django.contrib import admin
from django.urls import path, include
from apps.alerts.views import check_price_now
from apps.catalog.views import AffiliateRedirectView, CatalogView, ProductPublicView

urlpatterns = [
    path("admin/",       admin.site.urls),
    path("staff/",       include("apps.staff.urls")),
    path("api/check-price/", check_price_now),
    path("go/<slug:product_slug>/<slug:marketplace_slug>/", AffiliateRedirectView.as_view(), name="affiliate_redirect"),
    path("comparar/",    CatalogView.as_view(),            name="catalog"),
    path("producto/<slug:slug>/", ProductPublicView.as_view(), name="product_detail"),
]
