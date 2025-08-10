from django.contrib import admin
from .models import Category, Product, ProductImage, CategoryImage, ProductReview

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'unit', 'price', 'sale_price', 'stock_qty')
    list_filter  = ('category', 'unit')
    search_fields = ('name', 'description')
    inlines = [ProductImageInline]

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'user', 'stars', 'created_at')
    search_fields = ('product__name', 'user__email', 'user__username')
    list_filter = ('stars',)

admin.site.register(ProductImage)
admin.site.register(CategoryImage)
