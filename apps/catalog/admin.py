from django.contrib import admin
from .models import Marketplace, Category, ReferenceProduct, ProductURL


class ProductURLInline(admin.TabularInline):
    model = ProductURL
    extra = 1


@admin.register(ReferenceProduct)
class ReferenceProductAdmin(admin.ModelAdmin):
    list_display  = ["name", "category", "marketplace_count", "featured", "active", "created_at"]
    list_filter   = ["featured", "active", "category"]
    list_editable = ["featured", "active"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ProductURLInline]


@admin.register(Marketplace)
class MarketplaceAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "base_url", "active"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    prepopulated_fields = {"slug": ("name",)}
