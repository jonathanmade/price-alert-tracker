from django.contrib.sitemaps import Sitemap
from .models import Category, ReferenceProduct


class ProductSitemap(Sitemap):
    changefreq = "daily"
    priority = 0.8

    def items(self):
        return ReferenceProduct.objects.filter(active=True).order_by("slug")

    def location(self, obj):
        return f"/producto/{obj.slug}/"

    def lastmod(self, obj):
        return obj.updated_at


class CatalogSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.6

    def items(self):
        categories = list(
            Category.objects
            .filter(products__active=True)
            .distinct()
            .order_by("slug")
        )
        return ["__root__"] + categories

    def location(self, item):
        if item == "__root__":
            return "/comparar/"
        return f"/comparar/{item.slug}/"
