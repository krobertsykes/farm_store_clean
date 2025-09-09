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
    inlines = [OrderItemInline]
    list_display = ("order_number", "customer", "email", "created_at", "total_display")
    list_display_links = ("order_number",)
    list_filter = ("created_at",)
    search_fields = ("email", "user__email")
    readonly_fields = ("customer_display",)

    # Changelist columns
    def customer(self, obj):
        return obj.user
    customer.short_description = "CUSTOMER"
    customer.admin_order_field = "user"

    def total_display(self, obj):
        # ensure dollar sign display in list
        return f"${obj.total}"
    total_display.short_description = "Total"
    total_display.admin_order_field = "total"

    # Detail form: show 'Customer' as a readonly field, not the raw FK widget
    def customer_display(self, obj):
        return obj.user
    customer_display.short_description = "Customer"

    def get_fields(self, request, obj=None):
        fields = list(super().get_fields(request, obj))
        # Remove id and order_number if present
        for f in ("id", "order_number"):
            if f in fields:
                fields.remove(f)
        # Replace 'user' with 'customer_display'
        if "user" in fields:
            idx = fields.index("user")
            fields[idx] = "customer_display"
        else:
            # make sure customer_display is near top if not present
            if "customer_display" not in fields:
                fields.insert(0, "customer_display")
        return fields

    # Titles
    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context["title"] = "Select order to view details"
        return super().changelist_view(request, extra_context=extra_context)

    def changeform_view(self, request, object_id=None, form_url='', extra_context=None):
        extra_context = extra_context or {}
        extra_context["title"] = "Order Details"
        return super().changeform_view(request, object_id, form_url, extra_context=extra_context)
@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("product", "user", "stars", "created_at")
    list_filter = ("stars", "created_at")
    search_fields = ("product__name", "user__email")
