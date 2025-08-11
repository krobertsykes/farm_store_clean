from __future__ import annotations
from django.urls import path
from django.contrib.auth import views as auth_views

from . import views

app_name = "accounts"

urlpatterns = [
    path("login/", auth_views.LoginView.as_view(template_name="store/auth/login.html"), name="login"),
    path("logout/", auth_views.LogoutView.as_view(next_page="store:catalogue"), name="logout"),
    path("signup/", views.signup_view, name="signup"),
    path("profile/", views.profile_view, name="profile"),
    path("orders/", views.orders_view, name="orders"),
]
