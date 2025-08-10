from decimal import Decimal
from django.conf import settings
from django.db import models
from django.utils import timezone
from products.models import Product

User = settings.AUTH_USER_MODEL

class Profile(models.Model):
    user  = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=32, blank=True)

    def __str__(self):
        return f"Profile({self.user})"


class Coupon(models.Model):
    code        = models.CharField(max_length=40, unique=True)
    description = models.CharField(max_length=120, blank=True)
    percent_off = models.PositiveSmallIntegerField(null=True, blank=True)   # e.g., 10 = 10%
    amount_off  = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)  # fixed $
    active      = models.BooleanField(default=True)
    expires_at  = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.code

    def is_valid(self):
        return self.active and (self.expires_at is None or timezone.now() < self.expires_at)


class Order(models.Model):
    class PaymentMethod(models.TextChoices):
        CASH   = 'cash', 'Cash on Pickup'
        STRIPE = 'stripe', 'Card (Stripe - demo)'
        PAYPAL = 'paypal', 'PayPal (demo)'

    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    guest_email = models.EmailField(blank=True)  # used if user is None
    phone       = models.CharField(max_length=32, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    coupon      = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True)
    payment_method = models.CharField(max_length=12, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    paid        = models.BooleanField(default=False)
    subtotal    = models.DecimalField(max_digits=9, decimal_places=2, default=0)
    discount    = models.DecimalField(max_digits=9, decimal_places=2, default=0)
    total       = models.DecimalField(max_digits=9, decimal_places=2, default=0)

    def __str__(self):
        ident = self.id or "new"
        who = self.user.email if self.user else self.guest_email
        return f"Order #{ident} for {who}"


class OrderItem(models.Model):
    order    = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product  = models.ForeignKey(Product, on_delete=models.PROTECT)
    qty      = models.DecimalField(max_digits=7, decimal_places=2)
    unit     = models.CharField(max_length=2)  # snapshot of product.unit
    price    = models.DecimalField(max_digits=7, decimal_places=2)  # effective price at order time
    line_total = models.DecimalField(max_digits=9, decimal_places=2)

    def __str__(self):
        return f"{self.product.name} x {self.qty}"
