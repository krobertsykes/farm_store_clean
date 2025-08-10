from decimal import Decimal
from django.db import models
from django.utils.text import slugify
from django.contrib.auth import get_user_model

User = get_user_model()

# ─────────────────────────  CATEGORY  ─────────────────────────
class Category(models.Model):
    name        = models.CharField(max_length=100, unique=True)
    slug        = models.SlugField(max_length=120, unique=True, blank=True)
    description = models.TextField(blank=True)

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

    category    = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="products")
    name        = models.CharField(max_length=100)
    slug        = models.SlugField(max_length=120, unique=True, blank=True)
    description = models.TextField(blank=True)

    unit        = models.CharField(max_length=2, choices=Unit.choices, default=Unit.EACH)
    price       = models.DecimalField(max_digits=7, decimal_places=2, help_text="Price per unit")
    stock_qty   = models.DecimalField(max_digits=7, decimal_places=2, default=0, help_text="How many in stock")

    # Optional sale price (if set & < price, show crossed-out original)
    sale_price  = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)

    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def effective_price(self) -> Decimal:
        sp = self.sale_price
        if sp is not None and sp > 0 and sp < self.price:
            return sp
        return self.price

    @property
    def avg_rating(self):
        agg = self.reviews.aggregate(models.Avg('stars'))
        return (agg['stars__avg'] or 0)


# ─────────────────────────  IMAGES  ─────────────────────────
class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image   = models.ImageField(upload_to="products")
    alt     = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ("id",)

    def __str__(self):
        return f"{self.product.name} image {self.id}"


class CategoryImage(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="images")
    image    = models.ImageField(upload_to="categories")
    alt      = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ("id",)

    def __str__(self):
        return f"{self.category.name} image {self.id}"


# ─────────────────────────  REVIEWS  ─────────────────────────
class ProductReview(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user    = models.ForeignKey(User, on_delete=models.CASCADE, related_name='product_reviews')
    stars   = models.PositiveSmallIntegerField(choices=[(i, str(i)) for i in range(1, 6)])
    text    = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('product', 'user')
        ordering = ('-created_at',)

    def __str__(self):
        return f"{self.product.name} ★{self.stars} by {self.user.email or self.user.username}"
