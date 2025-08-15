# products/admin.py
from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html, format_html_join

from .models import Category, Product, ProductImage, CategoryImage, ProductReview
from .forms import ProductAdminForm  # keep using your existing form

# ─────────────────────────  INLINES  ─────────────────────────

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ("image", "alt", "preview")
    readonly_fields = ("preview",)

    def preview(self, obj):
        if getattr(obj, "image", None):
            return format_html('<img src="{}" style="height:60px; width:auto; border-radius:4px;" />', obj.image.url)
        return "—"
    preview.short_description = "Preview"


class ProductInline(admin.TabularInline):
    """Products editable directly under a Category page."""
    model = Product
    fk_name = "category"   # be explicit about the FK to Category
    extra = 1              # show one blank row so the inline is always visible
    fields = (
        "name", "unit", "price", "sale_price",
        "effective_price",  # read-only display of computed price
        "stock_qty", "slug", "description",
    )
    readonly_fields = ("effective_price",)
    show_change_link = True


# ─────────────────────────  ADMINS  ─────────────────────────

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    form = ProductAdminForm

    list_display = ("thumb", "name", "category", "unit", "price", "sale_price", "stock_qty")
    list_filter = ("category", "unit")
    search_fields = ("name", "description")
    inlines = [ProductImageInline]

    list_display_links = ("name",)
    list_editable = ("category", "unit", "price", "sale_price", "stock_qty")

    def thumb(self, obj):
        pic = obj.images.first()
        if pic and pic.image:
            return format_html('<img src="{}" style="height:40px; width:auto; border-radius:4px;" />', pic.image.url)
        return "—"
    thumb.short_description = "Img"

    # Remove plus/pencil/eye icons next to the Category field at the form level
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        formfield = super().formfield_for_foreignkey(db_field, request, **kwargs)
        if db_field.name == "category":
            w = formfield.widget
            for attr in ("can_add_related", "can_change_related", "can_view_related", "can_delete_related"):
                if hasattr(w, attr):
                    setattr(w, attr, False)
        return formfield

    # Prefill category when adding a product via the Category row button
    def get_changeform_initial_data(self, request):
        initial = super().get_changeform_initial_data(request)
        cat_id = request.GET.get("category")
        if cat_id:
            initial["category"] = cat_id
        return initial

    class Media:
        css = {"all": ("products/admin_overrides.css",)}
        js = ("products/admin_overrides.js",)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    # Show products on the LIST page with quick edit links, plus an add button
    list_display = ("name", "products_count", "products_links", "add_product_link")
    search_fields = ("name",)
    inlines = [ProductInline]  # keeps inline editing on the CHANGE page

    def products_count(self, obj):
        return obj.products.count()
    products_count.short_description = "Products"

    def products_links(self, obj):
        """
        Read-only list of products with quick 'Change' links.
        """
        qs = obj.products.all().only("id", "name").order_by("name")
        if not qs.exists():
            return "—"

        def link(p):
            url = reverse("admin:products_product_change", args=[p.id])
            return format_html('<a href="{}">{}</a>', url, p.name)

        return format_html_join(", ", "{}", ((link(p),) for p in qs))
    products_links.short_description = "Products (quick edit)"

    def add_product_link(self, obj):
        """
        Shortcut to add a new product with this category preselected.
        """
        url = reverse("admin:products_product_add")
        return format_html('<a class="button" href="{}?category={}">+ Add Product</a>', url, obj.id)
    add_product_link.short_description = "Add"


@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display = ("product", "user", "stars", "created_at")
    search_fields = ("product__name", "user__email", "user__username")
    list_filter = ("stars",)


admin.site.register(ProductImage)
# admin.site.register(CategoryImage)  # intentionally not registered
