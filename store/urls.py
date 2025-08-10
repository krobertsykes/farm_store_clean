from django.urls import path
from . import views

app_name = "store"

urlpatterns = [
    path("",                views.CatalogueView.as_view(),   name="catalogue"),
    path("add/<int:pk>/",   views.add_to_cart,               name="add_to_cart"),
    path("cart/",           views.CartView.as_view(),        name="cart"),
    path("cart/remove/<int:pk>/", views.remove_from_cart,    name="remove_from_cart"),
    path("cart/update/<int:pk>/", views.update_qty,          name="update_qty"),

    # Ratings (login required in view)
    path("rate/<int:pk>/",  views.rate_product,              name="rate_product"),

    # Checkout
    path("checkout/",       views.CheckoutView.as_view(),    name="checkout"),
    path("apply-coupon/",   views.apply_coupon,              name="apply_coupon"),
    path("order/thanks/<int:order_id>/", views.OrderThankYouView.as_view(), name="order_thanks"),
]
