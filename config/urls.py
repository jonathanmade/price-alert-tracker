from django.contrib import admin
from django.urls import path
from apps.alerts.views import check_price_now

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/check-price/", check_price_now),
]
