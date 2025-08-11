from __future__ import annotations
from django.urls import path

from . import views

app_name = "store"

urlpatterns = [
    path("", views.catalogue, name="catalogue"),
    path("cart/", views.cart_view, name="cart"),
    path("cart/update/<int:product_id>/", views.cart_update_qty, name="update_qty"),
    path("cart/remove/<int:product_id>/", views.cart_remove, name="remove_from_cart"),
    path("coupon/apply/", views.apply_coupon, name="apply_coupon"),
    path("checkout/", views.checkout_view, name="checkout"),
    path("thanks/<int:order_id>/", views.thanks_view, name="thanks"),
    path("product/<int:product_id>/rate/", views.rate_product, name="rate_product"),
    path("product/<int:product_id>/reviews/", views.reviews_detail, name="reviews_detail"),
    path("product/<int:product_id>/favorite/", views.toggle_favorite, name="toggle_favorite"),  # NEW
]
