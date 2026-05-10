from django.contrib import admin
from django.urls import path, include
from apps.alerts.views import check_price_now
from apps.catalog.views import AffiliateRedirectView

urlpatterns = [
    path("admin/",       admin.site.urls),
    path("staff/",       include("apps.staff.urls")),
    path("api/check-price/", check_price_now),
    path("go/<slug:product_slug>/<slug:marketplace_slug>/", AffiliateRedirectView.as_view(), name="affiliate_redirect"),
]
