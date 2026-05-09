from django.contrib import admin
from .models import Alert


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ["product", "user", "target_price", "status", "triggered_at", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["product__name", "user__email"]
    readonly_fields = ["triggered_at", "created_at"]
