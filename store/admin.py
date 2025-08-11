from __future__ import annotations
from django.contrib import admin
from .models import Profile, Coupon, Order, OrderItem, Rating

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone", "signup_discount_ends_at")
    search_fields = ("user__email", "phone")

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    # CHANGED: removed 'expires_at' (which wasn't a field) and show end_at instead
    list_display = ("code", "percent_off", "amount_off", "start_at", "end_at", "active")
    list_filter = ("active",)
    search_fields = ("code",)

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "qty", "unit", "unit_price", "line_total")

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "email", "created_at", "total")
    list_filter = ("created_at",)
    search_fields = ("email", "user__email")
    inlines = [OrderItemInline]

@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("product", "user", "stars", "created_at")
    list_filter = ("stars", "created_at")
    search_fields = ("product__name", "user__email")

# IMPORTANT: Do NOT register Product here — it's already registered in the products app.
