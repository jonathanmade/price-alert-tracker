from django.db.models import Count, Min, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views import View

from .models import AffiliateClick, Category, ProductURL, ReferenceProduct


# ── Affiliate redirect ────────────────────────────────────────────────────────

class AffiliateRedirectView(View):
    """
    Registra el clic y redirige a la URL de afiliado.
    URL pública: /go/<product_slug>/<marketplace_slug>/
    """
    def get(self, request, product_slug, marketplace_slug):
        product_url = get_object_or_404(
            ProductURL,
            product__slug=product_slug,
            marketplace__slug=marketplace_slug,
            active=True,
        )

        AffiliateClick.objects.create(
            product_url=product_url,
            ip_hash=AffiliateClick.hash_ip(request.META.get("REMOTE_ADDR", "")),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
            referer=request.META.get("HTTP_REFERER", "")[:500],
        )

        return redirect(product_url.build_affiliate_url())


# ── Public catalog ────────────────────────────────────────────────────────────

def _catalog_context(category=None):
    """Devuelve el queryset y categorías para las vistas públicas de catálogo."""
    products = (
        ReferenceProduct.objects
        .filter(active=True)
        .select_related("category")
        .annotate(
            lowest=Min("urls__current_price", filter=Q(urls__active=True)),
            mp_count=Count("urls", filter=Q(urls__active=True)),
        )
        .order_by("name")
    )
    if category:
        products = products.filter(category=category)

    categories = (
        Category.objects
        .filter(products__active=True)
        .distinct()
        .order_by("name")
    )
    return products, categories


class CatalogView(View):
    """Listado público de todos los productos."""
    def get(self, request):
        # Redirige URLs ?cat= legacy a la URL canónica limpia
        cat_slug = request.GET.get("cat", "").strip()
        if cat_slug:
            return redirect(f"/comparar/{cat_slug}/", permanent=True)

        products, categories = _catalog_context()
        return render(request, "catalog/catalog.html", {
            "products":     products,
            "categories":   categories,
            "selected_cat": None,
            "category":     None,
        })


class CategoryView(View):
    """Listado público filtrado por categoría (URL canónica para SEO)."""
    def get(self, request, category_slug):
        category = get_object_or_404(Category, slug=category_slug)
        products, categories = _catalog_context(category=category)
        return render(request, "catalog/catalog.html", {
            "products":     products,
            "categories":   categories,
            "selected_cat": category_slug,
            "category":     category,
        })


class ProductPublicView(View):
    """Página pública de comparación de precios por marketplace."""
    def get(self, request, slug):
        product = get_object_or_404(
            ReferenceProduct.objects
            .select_related("category")
            .prefetch_related("urls__marketplace"),
            slug=slug,
            active=True,
        )

        urls = sorted(
            [u for u in product.urls.all() if u.active],
            key=lambda u: (u.current_price is None, u.current_price or 0),
        )
        lowest_price = urls[0].current_price if urls and urls[0].current_price else None

        return render(request, "catalog/product_detail.html", {
            "product":      product,
            "urls":         urls,
            "lowest_price": lowest_price,
        })


# ── SEO helpers ───────────────────────────────────────────────────────────────

def robots_txt(request):
    sitemap_url = request.build_absolute_uri("/sitemap.xml")
    content = "\n".join([
        "User-agent: *",
        "Allow: /",
        "Disallow: /staff/",
        "Disallow: /admin/",
        "Disallow: /api/",
        "Disallow: /go/",
        "",
        f"Sitemap: {sitemap_url}",
    ])
    return HttpResponse(content, content_type="text/plain; charset=utf-8")
