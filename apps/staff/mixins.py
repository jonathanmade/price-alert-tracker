from django.shortcuts import redirect


def is_staff_user(request):
    """True si hay una sesión de staff activa (autenticada vía Supabase)."""
    return bool(request.session.get("staff_user"))


class StaffAccessMixin:
    def dispatch(self, request, *args, **kwargs):
        if not request.session.get("staff_user"):
            return redirect("/staff/login/")
        return super().dispatch(request, *args, **kwargs)


class AdminOnlyMixin(StaffAccessMixin):
    """Alias de StaffAccessMixin — todos los staff tienen acceso admin."""
    pass
