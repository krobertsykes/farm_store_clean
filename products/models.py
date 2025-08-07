# C:\code\farm_store\products\models.py

from django.db import models
from django.utils.text import slugify


# ─────────────────────────  CATEGORY  ─────────────────────────
class Category(models.Model):
    """Top-level group such as “Mushrooms”, “Tomatoes”, …"""

    name        = models.CharField(max_length=100, unique=True)
    slug        = models.SlugField(max_length=120, unique=True, blank=True)
    description = models.TextField(blank=True)
    # we’ll use a unified images inline, so drop the single `photo`:
    # photo    = models.ImageField(upload_to="categories", blank=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ("name",)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


# ─────────────────────────  PRODUCT  ─────────────────────────
class Product(models.Model):
    class Unit(models.TextChoices):
        EACH  = "ea", "Each"
        POUND = "lb", "Pound"
        OUNCE = "oz", "Ounce"
        KG    = "kg", "Kilogram"

    category    = models.ForeignKey(
                      Category, on_delete=models.CASCADE,
                      related_name="products"
                  )
    name        = models.CharField(max_length=100)
    slug        = models.SlugField(max_length=120, unique=True, blank=True)
    description = models.TextField(blank=True)

    # ─── unified unit field ─────────────────────────────────────
    unit        = models.CharField(
                      max_length=2,
                      choices=Unit.choices,
                      default=Unit.EACH,
                  )
    price       = models.DecimalField(
                      max_digits=7,
                      decimal_places=2,
                      help_text="Price per unit"
                  )
    stock_qty   = models.DecimalField(
                      max_digits=7,
                      decimal_places=2,
                      default=0,
                      help_text="How many in stock"
                  )
    # ────────────────────────────────────────────────────────────

    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # auto-slug
        if not self.slug:
            self.slug = slugify(self.name)
        # keep the unit applied consistently
        # (no need to sync two separate fields anymore)
        super().save(*args, **kwargs)


# ─────────────────────────  IMAGES  ─────────────────────────
class ProductImage(models.Model):
    product = models.ForeignKey(
                  Product, on_delete=models.CASCADE,
                  related_name="images"
              )
    image   = models.ImageField(upload_to="products")
    alt     = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ("id",)

    def __str__(self):
        return f"{self.product.name} image {self.id}"


class CategoryImage(models.Model):
    category = models.ForeignKey(
                   Category, on_delete=models.CASCADE,
                   related_name="images"
               )
    image    = models.ImageField(upload_to="categories")
    alt      = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ("id",)

    def __str__(self):
        return f"{self.category.name} image {self.id}"
