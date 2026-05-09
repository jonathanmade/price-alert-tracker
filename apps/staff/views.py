from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.utils.text import slugify
from supabase import create_client

from .mixins import StaffAccessMixin, AdminOnlyMixin, is_staff_user
from apps.catalog.models import ReferenceProduct, ProductURL, Marketplace, Category


def _supabase():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


# ── Auth ──────────────────────────────────────────────────────────────────────

class StaffLoginView(View):
    def get(self, request):
        if is_staff_user(request.user):
            return redirect("/staff/")
        return render(request, "staff/login.html")

    def post(self, request):
        email    = request.POST.get("email", "").strip()
        password = request.POST.get("password", "")
        user     = authenticate(request, username=email, password=password)
        if user and is_staff_user(user):
            login(request, user)
            return redirect("/staff/")
        return render(request, "staff/login.html", {
            "error": "Credenciales incorrectas o sin permisos de acceso."
        })


class StaffLogoutView(View):
    def get(self, request):
        logout(request)
        return redirect("/staff/login/")


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardView(StaffAccessMixin, View):
    def get(self, request):
        sb = _supabase()

        products_count   = len(sb.table("products").select("id").execute().data or [])
        active_alerts    = len(sb.table("alerts").select("id").eq("status", "active").execute().data or [])
        triggered_alerts = len(sb.table("alerts").select("id").eq("status", "triggered").execute().data or [])
        total_users      = len(sb.table("profiles").select("id").execute().data or [])

        recent_checks = (
            sb.table("price_history")
            .select("price, checked_at, products(name, url)")
            .order("checked_at", desc=True)
            .limit(8)
            .execute()
            .data or []
        )

        ref_products = ReferenceProduct.objects.count()

        modules = [
            {"num": "1", "label": "Roles y permisos",    "done": True},
            {"num": "2", "label": "Panel admin",          "done": True},
            {"num": "3", "label": "Afiliación",           "done": False},
            {"num": "4", "label": "Comparador",           "done": False},
            {"num": "5", "label": "SEO programático",     "done": False},
            {"num": "6", "label": "Historial y gráficas", "done": True},
            {"num": "7", "label": "Cupones",              "done": False},
            {"num": "8", "label": "Telegram",             "done": False},
        ]

        return render(request, "staff/dashboard.html", {
            "products_count":   products_count,
            "active_alerts":    active_alerts,
            "triggered_alerts": triggered_alerts,
            "total_users":      total_users,
            "recent_checks":    recent_checks,
            "ref_products":     ref_products,
            "modules":          modules,
        })


# ── Products CRUD ─────────────────────────────────────────────────────────────

class ProductListView(StaffAccessMixin, View):
    def get(self, request):
        q        = request.GET.get("q", "").strip()
        category = request.GET.get("category", "")
        products = ReferenceProduct.objects.prefetch_related("urls__marketplace", "category").all()
        if q:
            products = products.filter(name__icontains=q)
        if category:
            products = products.filter(category__slug=category)
        return render(request, "staff/products/list.html", {
            "products":   products,
            "categories": Category.objects.all(),
            "q":          q,
            "category":   category,
        })


class ProductCreateView(StaffAccessMixin, View):
    def get(self, request):
        mps = [{"mp": mp, "url": "", "affiliate_url": ""} for mp in Marketplace.objects.filter(active=True)]
        return render(request, "staff/products/form.html", {
            "categories":        Category.objects.all(),
            "marketplace_urls":  mps,
            "product":           None,
        })

    def post(self, request):
        name      = request.POST.get("name", "").strip()
        slug      = request.POST.get("slug", "").strip() or slugify(name)
        desc      = request.POST.get("description", "").strip()
        image_url = request.POST.get("image_url", "").strip()
        cat_id    = request.POST.get("category") or None
        active    = request.POST.get("active") == "on"

        if not name:
            messages.error(request, "El nombre es obligatorio.")
            return redirect("/staff/products/new/")

        product = ReferenceProduct.objects.create(
            name=name, slug=slug, description=desc,
            image_url=image_url, category_id=cat_id, active=active,
        )

        # URLs por marketplace
        for mp in Marketplace.objects.filter(active=True):
            url     = request.POST.get(f"mp_url_{mp.id}", "").strip()
            aff_url = request.POST.get(f"mp_aff_{mp.id}", "").strip()
            if url:
                ProductURL.objects.create(
                    product=product, marketplace=mp,
                    url=url, affiliate_url=aff_url,
                )

        messages.success(request, f"Producto «{product.name}» creado correctamente.")
        return redirect("/staff/products/")


class ProductEditView(StaffAccessMixin, View):
    def get(self, request, pk):
        product = get_object_or_404(ReferenceProduct, pk=pk)
        pu_map  = {pu.marketplace_id: pu for pu in product.urls.all()}
        mps = []
        for mp in Marketplace.objects.filter(active=True):
            pu = pu_map.get(mp.id)
            mps.append({
                "mp":            mp,
                "url":           pu.url if pu else "",
                "affiliate_url": pu.affiliate_url if pu else "",
            })
        return render(request, "staff/products/form.html", {
            "product":           product,
            "categories":        Category.objects.all(),
            "marketplace_urls":  mps,
        })

    def post(self, request, pk):
        product           = get_object_or_404(ReferenceProduct, pk=pk)
        product.name      = request.POST.get("name", "").strip()
        product.slug      = request.POST.get("slug", "").strip() or slugify(product.name)
        product.description = request.POST.get("description", "").strip()
        product.image_url = request.POST.get("image_url", "").strip()
        product.category_id = request.POST.get("category") or None
        product.active    = request.POST.get("active") == "on"
        product.save()

        for mp in Marketplace.objects.filter(active=True):
            url     = request.POST.get(f"mp_url_{mp.id}", "").strip()
            aff_url = request.POST.get(f"mp_aff_{mp.id}", "").strip()
            pu, _   = ProductURL.objects.get_or_create(product=product, marketplace=mp)
            pu.url           = url
            pu.affiliate_url = aff_url
            pu.active        = bool(url)
            pu.save()

        messages.success(request, f"Producto «{product.name}» actualizado.")
        return redirect("/staff/products/")


class ProductDeleteView(StaffAccessMixin, View):
    def post(self, request, pk):
        product = get_object_or_404(ReferenceProduct, pk=pk)
        name    = product.name
        product.delete()
        messages.success(request, f"Producto «{name}» eliminado.")
        return redirect("/staff/products/")


class ProductDetailView(StaffAccessMixin, View):
    def get(self, request, pk):
        product = get_object_or_404(
            ReferenceProduct.objects.prefetch_related("urls__marketplace"), pk=pk
        )
        return render(request, "staff/products/detail.html", {"product": product})


# ── Analytics ─────────────────────────────────────────────────────────────────

class AnalyticsView(StaffAccessMixin, View):
    def get(self, request):
        sb = _supabase()

        # Productos más seguidos (agrupa por URL)
        alerts_data = sb.table("alerts").select("products(name, url)").eq("status", "active").execute().data or []
        from collections import Counter
        name_counts = Counter(
            a["products"]["name"] for a in alerts_data if a.get("products")
        )
        top_products = [{"name": k, "count": v} for k, v in name_counts.most_common(10)]

        # Comprobaciones últimas 7 días
        from datetime import datetime, timedelta, timezone
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        checks_7d = len(
            sb.table("price_history").select("id").gte("checked_at", since).execute().data or []
        )

        # Usuarios con más alertas
        users_data = sb.table("alerts").select("user_id, profiles(email)").execute().data or []
        user_counts = Counter(
            a["profiles"]["email"] for a in users_data if a.get("profiles")
        )
        top_users = [{"email": k, "count": v} for k, v in user_counts.most_common(5)]

        mp_stats = []
        for mp in Marketplace.objects.filter(active=True):
            mp_stats.append({
                "name":  mp.name,
                "count": ProductURL.objects.filter(marketplace=mp, active=True).count(),
            })

        return render(request, "staff/analytics.html", {
            "top_products": top_products,
            "top_users":    top_users,
            "mp_stats":     mp_stats,
            "checks_7d":    checks_7d,
        })
