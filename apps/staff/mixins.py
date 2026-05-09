from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import redirect


def is_staff_user(user):
    """True si el usuario tiene acceso al panel de gestión."""
    return user.is_authenticated and (
        user.is_superuser
        or user.is_staff
        or user.groups.filter(name="content_manager").exists()
    )


class StaffAccessMixin(LoginRequiredMixin):
    login_url = "/staff/login/"

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        if not is_staff_user(request.user):
            return redirect("/staff/login/")
        return super().dispatch(request, *args, **kwargs)


class AdminOnlyMixin(LoginRequiredMixin):
    """Solo superusuarios o is_staff=True."""
    login_url = "/staff/login/"

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        if not (request.user.is_superuser or request.user.is_staff):
            return redirect("/staff/")
        return super().dispatch(request, *args, **kwargs)
