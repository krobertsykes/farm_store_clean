from django.urls import path
from . import views

app_name = "store"

urlpatterns = [
    path("",               views.CatalogueView.as_view(), name="catalogue"),
    path("add/<int:pk>/",  views.add_to_cart,             name="add_to_cart"),
    path("cart/",          views.CartView.as_view(),       name="cart"),
    path("cart/remove/<int:pk>/",  views.remove_from_cart, name="remove_from_cart"),  # ← new
    path("cart/update/<int:pk>/",  views.update_qty,       name="update_qty"),        # ← new
]
