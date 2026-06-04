from django.urls import path
from . import views

app_name = "staff"

urlpatterns = [
    path("",                        views.DashboardView.as_view(),     name="dashboard"),
    path("login/",                  views.StaffLoginView.as_view(),    name="login"),
    path("logout/",                 views.StaffLogoutView.as_view(),   name="logout"),
    path("password-reset/",         views.StaffPasswordResetView.as_view(), name="password_reset"),
    path("password-reset/confirm/", views.StaffPasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    # Products
    path("products/",               views.ProductListView.as_view(),   name="product_list"),
    path("products/new/",           views.ProductCreateView.as_view(), name="product_create"),
    path("products/<int:pk>/",      views.ProductDetailView.as_view(), name="product_detail"),
    path("products/<int:pk>/edit/", views.ProductEditView.as_view(),   name="product_edit"),
    path("products/<int:pk>/delete/", views.ProductDeleteView.as_view(), name="product_delete"),
    # Analytics
    path("analytics/",              views.AnalyticsView.as_view(),     name="analytics"),
    # Coupons
    path("coupons/",                views.CouponListView.as_view(),   name="coupon_list"),
    path("coupons/new/",            views.CouponCreateView.as_view(), name="coupon_create"),
    path("coupons/<int:pk>/edit/",  views.CouponEditView.as_view(),   name="coupon_edit"),
    path("coupons/<int:pk>/delete/",views.CouponDeleteView.as_view(), name="coupon_delete"),
]
