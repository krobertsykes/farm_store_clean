# C:\code\farm_store\products\admin.py

from decimal import Decimal
from django import forms
from django.contrib import admin
from django.utils.html import format_html
from .models import Category, Product, ProductImage

# ─────────────────────── ProductAdminForm ────────────────────────────────
class ProductAdminForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = "__all__"
        widgets = {
            "stock_qty": forms.NumberInput(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Choose step size: 1 for EACH, 0.25 for weight units
        if self.instance and self.instance.pk:
            unit = self.instance.unit
        else:
            unit = self.initial.get("unit", Product.Unit.EACH)
        step = "1" if unit == Product.Unit.EACH else "0.25"
        self.fields["stock_qty"].widget.attrs.update({"step": step})


# ──────────────────────── Inlines ─────────────────────────────────────────
class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductInline(admin.TabularInline):
    model = Product
    extra = 0
    show_change_link = True
    fields = ("main_image", "name", "unit", "price", "stock_qty")
    readonly_fields = ("main_image",)

    def main_image(self, obj):
        imgs = list(obj.images.all())
        if not imgs:
            return "-"
        first = imgs[0]
        extra = len(imgs) - 1
        badge = format_html(
            '<span style="position:absolute; top:0; right:0; '
            'background:red; color:white; border-radius:50%; '
            'padding:2px 5px; font-size:10px;">+{}</span>',
            extra
        ) if extra else ""
        return format_html(
            '<div style="position:relative; display:inline-block;">'
              '<img src="{}" style="width:40px; height:auto; '
              'border:1px solid #ccc; border-radius:4px;" />'
              '{}'
            '</div>',
            first.image.url,
            badge
        )
    main_image.short_description = "Image"


# ────────────────────────── ProductAdmin ───────────────────────────────────
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    form = ProductAdminForm
    list_display       = ("main_image", "name", "category", "unit", "price", "stock_qty")
    list_display_links = ("main_image", "name")
    list_filter        = ("category", "unit")
    search_fields      = ("name",)
    inlines            = [ProductImageInline]

    def main_image(self, obj):
        imgs = list(obj.images.all())
        if not imgs:
            return "-"
        first = imgs[0]
        extra = len(imgs) - 1
        badge = format_html(
            '<span style="position:absolute; top:0; right:0; '
            'background:red; color:white; border-radius:50%; '
            'padding:2px 5px; font-size:10px;">+{}</span>',
            extra
        ) if extra else ""
        return format_html(
            '<div style="position:relative; display:inline-block;">'
              '<img src="{}" style="width:50px; height:auto; '
              'border:1px solid #ccc; border-radius:4px;" />'
              '{}'
            '</div>',
            first.image.url,
            badge
        )
    main_image.short_description = "Image"


# ────────────────────────── CategoryAdmin ──────────────────────────────────
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display        = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines             = [ProductInline]

    def get_inline_instances(self, request, obj=None):
        """
        Only show ProductInline when editing an existing Category.
        On the 'Add' form (obj is None), no inlines will be displayed.
        """
        if obj is None:
            return []
        return super().get_inline_instances(request, obj)
