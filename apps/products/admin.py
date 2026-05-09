from django.contrib import admin
from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "current_price", "last_checked_at", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["name", "url", "user__email"]
    readonly_fields = ["current_price", "last_checked_at", "created_at"]
