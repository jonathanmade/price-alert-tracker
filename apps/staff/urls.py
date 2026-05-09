from django.urls import path
from . import views

app_name = "staff"

urlpatterns = [
    path("",                        views.DashboardView.as_view(),     name="dashboard"),
    path("login/",                  views.StaffLoginView.as_view(),    name="login"),
    path("logout/",                 views.StaffLogoutView.as_view(),   name="logout"),
    # Products
    path("products/",               views.ProductListView.as_view(),   name="product_list"),
    path("products/new/",           views.ProductCreateView.as_view(), name="product_create"),
    path("products/<int:pk>/",      views.ProductDetailView.as_view(), name="product_detail"),
    path("products/<int:pk>/edit/", views.ProductEditView.as_view(),   name="product_edit"),
    path("products/<int:pk>/delete/", views.ProductDeleteView.as_view(), name="product_delete"),
    # Analytics
    path("analytics/",              views.AnalyticsView.as_view(),     name="analytics"),
]
