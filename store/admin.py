from django.contrib import admin
from .models import Order, OrderItem, Coupon, Profile

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product', 'qty', 'unit', 'price', 'line_total')

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'guest_email', 'total', 'paid', 'created_at', 'payment_method', 'coupon')
    list_filter  = ('paid', 'payment_method', 'created_at')
    search_fields = ('user__email', 'guest_email')
    inlines = [OrderItemInline]

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'percent_off', 'amount_off', 'active', 'expires_at')
    list_filter  = ('active',)
    search_fields = ('code',)

admin.site.register(Profile)
