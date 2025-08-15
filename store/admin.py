from __future__ import annotations
from django.contrib import admin
from .models import Profile, Coupon, Order, OrderItem, Rating


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone", "signup_discount_ends_at")
    search_fields = ("user__email", "phone")


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    # Show & edit start/end dates; keep existing columns
    list_display = ("code", "percent_off", "amount_off", "start_at", "end_at", "active")
    list_filter = ("active", "start_at", "end_at")
    search_fields = ("code",)
    date_hierarchy = "start_at"
    fields = ("code", "percent_off", "amount_off", "start_at", "end_at", "active")


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
