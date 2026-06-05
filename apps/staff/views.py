import logging
from django.conf import settings
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.utils.text import slugify
from supabase import create_client

from .mixins import StaffAccessMixin, AdminOnlyMixin, is_staff_user
from apps.catalog.models import ReferenceProduct, ProductURL, Marketplace, Category, AffiliateClick, Coupon

logger = logging.getLogger(__name__)


def _supabase_error_response(request, view_name: str, exc: Exception):
    logger.error("Error Supabase en %s: %s", view_name, exc, exc_info=True)
    return render(request, "staff/error.html", {
        "message": "No se pudo conectar con Supabase. Inténtalo de nuevo en unos segundos.",
    }, status=503)


def _supabase():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


# ── Auth ──────────────────────────────────────────────────────────────────────

class StaffLoginView(View):
    def get(self, request):
        if request.session.get("staff_user"):
            return redirect("/staff/")
        return render(request, "staff/login.html")

    def post(self, request):
        email    = request.POST.get("email", "").strip()
        password = request.POST.get("password", "")

        try:
            sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
            res = sb.auth.sign_in_with_password({"email": email, "password": password})
            sb_user = res.user
        except Exception as exc:
            logger.warning("Staff login failed for %s: %s", email, exc)
            return render(request, "staff/login.html", {
                "error": "Credenciales incorrectas o sin permisos de acceso."
            })

        # Authorize: app_metadata.is_staff (set via Supabase Dashboard) or STAFF_EMAILS env var
        app_meta = sb_user.app_metadata or {}
        staff_emails = getattr(settings, "STAFF_EMAILS", [])
        if not (app_meta.get("is_staff") or sb_user.email in staff_emails):
            return render(request, "staff/login.html", {
                "error": "Credenciales incorrectas o sin permisos de acceso."
            })

        request.session["staff_user"] = {"id": str(sb_user.id), "email": sb_user.email}
        return redirect("/staff/")


class StaffLogoutView(View):
    def get(self, request):
        request.session.pop("staff_user", None)
        return redirect("/staff/login/")


class StaffPasswordResetView(View):
    def get(self, request):
        return render(request, "staff/password_reset.html")

    def post(self, request):
        email = request.POST.get("email", "").strip()
        if not email:
            return render(request, "staff/password_reset.html", {
                "error": "Introduce un email válido."
            })
        try:
            sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
            redirect_base = getattr(settings, "STAFF_BASE_URL", "https://dev.pricearadar.com")
            sb.auth.reset_password_email(
                email,
                options={"redirect_to": f"{redirect_base}/staff/password-reset/confirm/"}
            )
        except Exception as exc:
            logger.warning("Password reset failed for %s: %s", email, exc)
        # Siempre mostramos éxito — no revelar si el email existe
        return render(request, "staff/password_reset.html", {"success": True})


class StaffPasswordResetConfirmView(View):
    def get(self, request):
        return render(request, "staff/password_reset_confirm.html", {
            "supabase_url": settings.SUPABASE_URL,
            "supabase_anon_key": settings.SUPABASE_ANON_KEY,
        })


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardView(StaffAccessMixin, View):
    def get(self, request):
        try:
            sb = _supabase()
            products_count   = len(sb.table("products").select("id").execute().data or [])
            active_alerts    = len(sb.table("alerts").select("id").eq("status", "active").execute().data or [])
            triggered_alerts = len(sb.table("alerts").select("id").eq("status", "triggered").execute().data or [])
            total_users      = len(sb.table("profiles").select("id").execute().data or [])
            recent_checks    = (
                sb.table("price_history")
                .select("price, checked_at, products(name, url)")
                .order("checked_at", desc=True)
                .limit(8)
                .execute()
                .data or []
            )
        except Exception as exc:
            return _supabase_error_response(request, "DashboardView", exc)

        ref_products = ReferenceProduct.objects.count()

        modules = [
            {"num": "1",  "label": "Roles y permisos",                "done": True,  "in_progress": False},
            {"num": "2",  "label": "Panel admin + Productos",          "done": True,  "in_progress": False},
            {"num": "3",  "label": "Auth completa (reset password)",   "done": True,  "in_progress": False},
            {"num": "4",  "label": "Landing dinámica con reel",        "done": False, "in_progress": True},
            {"num": "5",  "label": "Historial y gráficas catálogo",    "done": False, "in_progress": True},
            {"num": "6",  "label": "Módulo de usuarios y estadísticas","done": False, "in_progress": False},
            {"num": "7",  "label": "Afiliación",                       "done": False, "in_progress": False},
            {"num": "8",  "label": "Cupones",                          "done": False, "in_progress": False},
            {"num": "9",  "label": "Comparador de precios",            "done": False, "in_progress": False},
            {"num": "10", "label": "SEO programático",                 "done": False, "in_progress": False},
            {"num": "11", "label": "Telegram",                         "done": False, "in_progress": False},
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
        try:
            name      = request.POST.get("name", "").strip()
            slug      = request.POST.get("slug", "").strip() or slugify(name)
            desc      = request.POST.get("description", "").strip()
            image_url = request.POST.get("image_url", "").strip()
            cat_id    = request.POST.get("category") or None
            active    = request.POST.get("active") == "on"
            featured  = request.POST.get("featured") == "on"

            if not name:
                messages.error(request, "El nombre es obligatorio.")
                return redirect("/staff/products/new/")

            product = ReferenceProduct.objects.create(
                name=name, slug=slug, description=desc,
                image_url=image_url, category_id=cat_id, active=active,
                featured=featured,
            )

            # URLs por marketplace
            for mp in Marketplace.objects.filter(active=True):
                url = request.POST.get(f"mp_url_{mp.id}", "").strip()
                if url and len(url) > 2000:
                    messages.error(request, f"La URL de {mp.name} es demasiado larga.")
                    return redirect(request.path)
                if url and not url.startswith("https://"):
                    messages.error(request, f"La URL de {mp.name} debe empezar por https://")
                    return redirect(request.path)
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
        except Exception as exc:
            import traceback
            logger.error("ERROR en ProductCreateView.post: %s\n%s",
                         exc, traceback.format_exc())
            raise


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
        product.featured  = request.POST.get("featured") == "on"
        product.save()

        for mp in Marketplace.objects.filter(active=True):
            url = request.POST.get(f"mp_url_{mp.id}", "").strip()
            if url and len(url) > 2000:
                messages.error(request, f"La URL de {mp.name} es demasiado larga.")
                return redirect(request.path)
            if url and not url.startswith("https://"):
                messages.error(request, f"La URL de {mp.name} debe empezar por https://")
                return redirect(request.path)
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
        try:
            return self._get(request)
        except Exception as exc:
            return _supabase_error_response(request, "AnalyticsView", exc)

    def _get(self, request):
        sb = _supabase()

        # Productos más seguidos — enriquecido con métricas de scraping y clics
        from collections import Counter, defaultdict
        alerts_data = sb.table("alerts").select(
            "products(id, name, url, scrape_ok_count, scrape_error_count, outbound_clicks)"
        ).eq("status", "active").execute().data or []

        product_map: dict = {}
        for a in alerts_data:
            p = a.get("products")
            if not p:
                continue
            pid = p["id"]
            if pid not in product_map:
                product_map[pid] = {
                    "id":                 pid,
                    "name":               p["name"],
                    "url":                p["url"],
                    "scrape_ok_count":    p.get("scrape_ok_count") or 0,
                    "scrape_error_count": p.get("scrape_error_count") or 0,
                    "outbound_clicks":    p.get("outbound_clicks") or 0,
                    "alert_count":        0,
                }
            product_map[pid]["alert_count"] += 1

        # Clics de precio: entradas en price_history por producto
        product_ids = list(product_map.keys())
        if product_ids:
            ph_rows = sb.table("price_history").select("product_id").in_("product_id", product_ids).execute().data or []
            ph_counts = Counter(r["product_id"] for r in ph_rows)
        else:
            ph_counts = Counter()

        top_products_list = sorted(product_map.values(), key=lambda x: x["alert_count"], reverse=True)[:10]
        for p in top_products_list:
            total = p["scrape_ok_count"] + p["scrape_error_count"]
            p["price_checks"]  = ph_counts.get(p["id"], 0)
            p["scrape_ok_pct"] = round(p["scrape_ok_count"] / total * 100) if total else None
            p["scrape_err_pct"] = round(p["scrape_error_count"] / total * 100) if total else None
        top_products = top_products_list

        # Comprobaciones últimas 7 días
        from datetime import datetime, timedelta, timezone
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        checks_7d = len(
            sb.table("price_history").select("id").gte("checked_at", since).execute().data or []
        )

        # Usuarios con más alertas (alerts no tiene FK directa a profiles)
        users_data = sb.table("alerts").select("user_id").execute().data or []
        user_id_counts = Counter(a["user_id"] for a in users_data if a.get("user_id"))
        top_user_ids = [uid for uid, _ in user_id_counts.most_common(5)]
        profiles_data = {}
        if top_user_ids:
            rows = sb.table("profiles").select("id, email").in_("id", top_user_ids).execute().data or []
            profiles_data = {r["id"]: r["email"] for r in rows}
        top_users = [
            {"email": profiles_data.get(uid, uid), "count": cnt}
            for uid, cnt in user_id_counts.most_common(5)
        ]

        mp_stats = []
        for mp in Marketplace.objects.filter(active=True):
            mp_stats.append({
                "name":   mp.name,
                "urls":   ProductURL.objects.filter(marketplace=mp, active=True).count(),
                "clicks": AffiliateClick.objects.filter(product_url__marketplace=mp).count(),
            })

        # Clics de afiliado
        from django.db.models import Count
        clicks_total = AffiliateClick.objects.count()
        clicks_7d    = AffiliateClick.objects.filter(
            clicked_at__gte=datetime.now(timezone.utc) - timedelta(days=7)
        ).count()

        top_clicked = (
            ProductURL.objects
            .annotate(total_clicks=Count("clicks"))
            .filter(total_clicks__gt=0)
            .select_related("product", "marketplace")
            .order_by("-total_clicks")[:10]
        )

        # Scraper health
        all_products = sb.table("products").select(
            "id, name, url, last_scrape_status, last_scrape_error, last_checked_at"
        ).not_.is_("last_scrape_status", "null").execute().data or []

        scrape_ok    = [p for p in all_products if p["last_scrape_status"] == "ok"]
        scrape_error = [p for p in all_products if p["last_scrape_status"] == "error"]
        total_scraped = len(all_products)
        scrape_ok_pct = round(len(scrape_ok) / total_scraped * 100) if total_scraped else 0

        return render(request, "staff/analytics.html", {
            "top_products":   top_products,
            "top_users":      top_users,
            "mp_stats":       mp_stats,
            "checks_7d":      checks_7d,
            "clicks_total":   clicks_total,
            "clicks_7d":      clicks_7d,
            "top_clicked":    top_clicked,
            "scrape_ok":      len(scrape_ok),
            "scrape_error":   len(scrape_error),
            "scrape_ok_pct":  scrape_ok_pct,
            "total_scraped":  total_scraped,
            "failed_products": sorted(scrape_error, key=lambda p: p.get("last_checked_at") or "", reverse=True)[:20],
        })


# ── Coupons CRUD ──────────────────────────────────────────────────────────────

class CouponListView(StaffAccessMixin, View):
    def get(self, request):
        mp_slug = request.GET.get("mp", "").strip()
        coupons = Coupon.objects.select_related("marketplace").all()
        if mp_slug:
            coupons = coupons.filter(marketplace__slug=mp_slug)
        return render(request, "staff/coupons/list.html", {
            "coupons":      coupons,
            "marketplaces": Marketplace.objects.filter(active=True),
            "mp_slug":      mp_slug,
        })


class CouponCreateView(StaffAccessMixin, View):
    def get(self, request):
        return render(request, "staff/coupons/form.html", {
            "coupon":       None,
            "marketplaces": Marketplace.objects.filter(active=True),
        })

    def post(self, request):
        mp_id          = request.POST.get("marketplace") or None
        code           = request.POST.get("code", "").strip().upper()
        description    = request.POST.get("description", "").strip()
        discount_type  = request.POST.get("discount_type", "percent")
        discount_value = request.POST.get("discount_value", "").strip() or None
        min_order      = request.POST.get("min_order", "").strip() or None
        valid_until    = request.POST.get("valid_until", "").strip() or None
        url            = request.POST.get("url", "").strip()
        active         = request.POST.get("active") == "on"
        verified       = request.POST.get("verified") == "on"

        if not (mp_id and code and description):
            messages.error(request, "Marketplace, código y descripción son obligatorios.")
            return redirect("/staff/coupons/new/")

        Coupon.objects.create(
            marketplace_id=mp_id,
            code=code,
            description=description,
            discount_type=discount_type,
            discount_value=discount_value,
            min_order=min_order,
            valid_until=valid_until,
            url=url,
            active=active,
            verified=verified,
        )
        messages.success(request, f"Cupón «{code}» creado correctamente.")
        return redirect("/staff/coupons/")


class CouponEditView(StaffAccessMixin, View):
    def get(self, request, pk):
        coupon = get_object_or_404(Coupon, pk=pk)
        return render(request, "staff/coupons/form.html", {
            "coupon":       coupon,
            "marketplaces": Marketplace.objects.filter(active=True),
        })

    def post(self, request, pk):
        coupon = get_object_or_404(Coupon, pk=pk)
        coupon.marketplace_id  = request.POST.get("marketplace") or None
        coupon.code            = request.POST.get("code", "").strip().upper()
        coupon.description     = request.POST.get("description", "").strip()
        coupon.discount_type   = request.POST.get("discount_type", "percent")
        coupon.discount_value  = request.POST.get("discount_value", "").strip() or None
        coupon.min_order       = request.POST.get("min_order", "").strip() or None
        coupon.valid_until     = request.POST.get("valid_until", "").strip() or None
        coupon.url             = request.POST.get("url", "").strip()
        coupon.active          = request.POST.get("active") == "on"
        coupon.verified        = request.POST.get("verified") == "on"
        coupon.save()
        messages.success(request, f"Cupón «{coupon.code}» actualizado.")
        return redirect("/staff/coupons/")


class CouponDeleteView(StaffAccessMixin, View):
    def post(self, request, pk):
        coupon = get_object_or_404(Coupon, pk=pk)
        code = coupon.code
        coupon.delete()
        messages.success(request, f"Cupón «{code}» eliminado.")
        return redirect("/staff/coupons/")


# ── Users ─────────────────────────────────────────────────────────────────────

class UserListView(StaffAccessMixin, View):
    def get(self, request):
        try:
            sb = _supabase()
            from datetime import datetime, timezone, timedelta
            now = datetime.now(timezone.utc)
            days_30_ago = (now - timedelta(days=30)).isoformat()
            days_7_ago  = (now - timedelta(days=7)).isoformat()

            # Todos los usuarios
            profiles = sb.table("profiles").select("id, email, credits, created_at").order("created_at", desc=True).execute().data or []

            # Totales
            total_users  = len(profiles)
            new_last_7d  = len([p for p in profiles if p.get("created_at", "") >= days_7_ago])
            new_last_30d = len([p for p in profiles if p.get("created_at", "") >= days_30_ago])

            # Alertas por usuario
            alerts_data = sb.table("alerts").select("user_id, status").execute().data or []
            alerts_by_user = {}
            for a in alerts_data:
                uid = a.get("user_id")
                if uid:
                    alerts_by_user[uid] = alerts_by_user.get(uid, 0) + 1

            active_alerts_total    = len([a for a in alerts_data if a.get("status") == "active"])
            triggered_alerts_total = len([a for a in alerts_data if a.get("status") == "triggered"])

            # Créditos
            transactions = sb.table("credit_transactions").select("user_id, amount, reason, created_at").order("created_at", desc=True).limit(100).execute().data or []
            credits_consumed_7d = sum(abs(t["amount"]) for t in transactions if t.get("amount", 0) < 0 and t.get("created_at", "") >= days_7_ago)

            # Enriquecer profiles con datos de alertas
            for p in profiles:
                p["alert_count"] = alerts_by_user.get(p["id"], 0)

            # Usuarios con más alertas
            top_users = sorted(profiles, key=lambda x: x["alert_count"], reverse=True)[:10]

            # Usuarios nuevos por día (últimos 7 días)
            from collections import Counter
            new_by_day = Counter()
            for p in profiles:
                created = p.get("created_at", "")
                if created >= days_7_ago:
                    day = created[:10]
                    new_by_day[day] += 1

        except Exception as exc:
            return _supabase_error_response(request, "UserListView", exc)

        return render(request, "staff/users/list.html", {
            "profiles":               profiles,
            "total_users":            total_users,
            "new_last_7d":            new_last_7d,
            "new_last_30d":           new_last_30d,
            "active_alerts_total":    active_alerts_total,
            "triggered_alerts_total": triggered_alerts_total,
            "credits_consumed_7d":    credits_consumed_7d,
            "top_users":              top_users,
            "new_by_day":             dict(sorted(new_by_day.items())),
            "transactions":           transactions[:20],
        })
