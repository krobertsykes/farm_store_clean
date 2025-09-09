from __future__ import annotations

from decimal import Decimal
from django.conf import settings
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    phone = models.CharField(max_length=30, blank=True)
    # For new-customer 10% discount
    signup_discount_ends_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Profile({self.user_id})"


class Coupon(models.Model):
    code = models.CharField(max_length=50, unique=True)
    percent_off = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    amount_off = models.DecimalField(max_digits=9, decimal_places=2, default=Decimal("0"))
    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-start_at", "code"]

    def __str__(self) -> str:
        return self.code

    def is_valid_now(self) -> bool:
        if not self.active:
            return False
        now = timezone.now()
        if self.start_at and now < self.start_at:
            return False
        if self.end_at and now > self.end_at:
            return False
        return True

    @staticmethod
    def normalize(code: str) -> str:
        return (code or "").strip().upper()


class Order(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    coupon = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    discount_total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    payment_method = models.CharField(max_length=40, default="card")  # placeholder

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Order #{self.order_number}"




    @property
    def order_number(self) -> str:
        return f"{self.pk + 99:04d}"
class OrderItem(models.Model):
    from products.models import Product  # local import to avoid circular at module import

    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT)
    qty = models.DecimalField(max_digits=10, decimal_places=3, validators=[MinValueValidator(Decimal("0"))])
    unit = models.CharField(max_length=8, default="ea")
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))

    def __str__(self) -> str:
        return f"{self.product} x {self.qty}"


class Rating(models.Model):
    product = models.ForeignKey("products.Product", related_name="ratings", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="ratings", on_delete=models.CASCADE)
    stars = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("product", "user")]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.product_id}:{self.user_id} → {self.stars}"


# ──────────────── Favorites (persistent across devices/logins) ────────────────
class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorites",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.CASCADE,
        related_name="favorited_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("user", "product"),)
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["user", "product"]),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} ♥ {self.product_id}"
