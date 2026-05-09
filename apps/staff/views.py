from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import render, redirect
from django.views import View
from supabase import create_client

from .mixins import StaffAccessMixin, is_staff_user


def _supabase():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


class StaffLoginView(View):
    def get(self, request):
        if is_staff_user(request.user):
            return redirect("/staff/")
        return render(request, "staff/login.html")

    def post(self, request):
        email = request.POST.get("email", "").strip()
        password = request.POST.get("password", "")
        user = authenticate(request, username=email, password=password)
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


class DashboardView(StaffAccessMixin, View):
    def get(self, request):
        sb = _supabase()

        products_count  = len(sb.table("products").select("id").execute().data or [])
        active_alerts   = len(sb.table("alerts").select("id").eq("status", "active").execute().data or [])
        triggered_alerts = len(sb.table("alerts").select("id").eq("status", "triggered").execute().data or [])
        total_users     = len(sb.table("profiles").select("id").execute().data or [])

        recent_checks = (
            sb.table("price_history")
            .select("price, checked_at, products(name, url)")
            .order("checked_at", desc=True)
            .limit(8)
            .execute()
            .data or []
        )

        modules = [
            {"num": "1", "label": "Roles y permisos",    "done": True},
            {"num": "2", "label": "Panel admin",          "done": False},
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
            "modules":          modules,
        })
