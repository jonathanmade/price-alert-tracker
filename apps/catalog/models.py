import hashlib
from django.db import models
from django.utils.text import slugify


class Marketplace(models.Model):
    name           = models.CharField(max_length=100)
    slug           = models.SlugField(unique=True)
    base_url       = models.URLField()
    affiliate_tag  = models.CharField(max_length=200, blank=True)
    active         = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "marketplace"

    def __str__(self):
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "categoría"
        verbose_name_plural = "categorías"

    def __str__(self):
        return self.name


class ReferenceProduct(models.Model):
    name        = models.CharField(max_length=255)
    slug        = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True)
    image_url   = models.URLField(blank=True)
    category    = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="products")
    active      = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "producto de referencia"
        verbose_name_plural = "productos de referencia"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def marketplace_count(self):
        return self.urls.filter(active=True).count()

    @property
    def lowest_price(self):
        prices = self.urls.filter(active=True, current_price__isnull=False).values_list("current_price", flat=True)
        return min(prices) if prices else None


class ProductURL(models.Model):
    product        = models.ForeignKey(ReferenceProduct, on_delete=models.CASCADE, related_name="urls")
    marketplace    = models.ForeignKey(Marketplace, on_delete=models.CASCADE)
    url            = models.URLField()
    affiliate_url  = models.URLField(blank=True)
    current_price  = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    last_checked   = models.DateTimeField(null=True, blank=True)
    active         = models.BooleanField(default=True)

    class Meta:
        unique_together = ("product", "marketplace")
        verbose_name = "URL de producto"
        verbose_name_plural = "URLs de producto"

    def __str__(self):
        return f"{self.product.name} — {self.marketplace.name}"

    def build_affiliate_url(self) -> str:
        """Devuelve la URL de destino con tag de afiliado si está configurado."""
        if self.affiliate_url:
            return self.affiliate_url
        tag = self.marketplace.affiliate_tag
        if self.marketplace.slug == "amazon" and tag:
            sep = "&" if "?" in self.url else "?"
            return f"{self.url}{sep}tag={tag}"
        return self.url

    @property
    def click_count(self) -> int:
        return self.clicks.count()


class AffiliateClick(models.Model):
    product_url = models.ForeignKey(ProductURL, on_delete=models.CASCADE, related_name="clicks")
    ip_hash     = models.CharField(max_length=64, blank=True)   # SHA-256 — sin datos personales
    user_agent  = models.CharField(max_length=300, blank=True)
    referer     = models.CharField(max_length=500, blank=True)
    clicked_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-clicked_at"]
        verbose_name = "clic de afiliado"
        verbose_name_plural = "clics de afiliado"

    def __str__(self):
        return f"{self.product_url} — {self.clicked_at:%Y-%m-%d %H:%M}"

    @staticmethod
    def hash_ip(ip: str) -> str:
        return hashlib.sha256(ip.encode()).hexdigest() if ip else ""
