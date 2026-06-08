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
    featured    = models.BooleanField(
        default=False,
        help_text="Mostrar en el reel de la landing page.",
    )
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
    url            = models.URLField(max_length=2000)
    affiliate_url  = models.URLField(max_length=2000, blank=True)
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


class Coupon(models.Model):
    DISCOUNT_TYPES = [
        ("percent",      "% descuento"),
        ("fixed",        "€ fijo"),
        ("free_shipping","Envío gratis"),
    ]

    marketplace    = models.ForeignKey(Marketplace, on_delete=models.CASCADE, related_name="coupons")
    code           = models.CharField(max_length=100)
    description    = models.CharField(max_length=300)
    discount_type  = models.CharField(max_length=20, choices=DISCOUNT_TYPES, default="percent")
    discount_value = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    min_order      = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    valid_until    = models.DateField(null=True, blank=True)
    url            = models.URLField(blank=True)
    active         = models.BooleanField(default=True)
    verified       = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "cupón"
        verbose_name_plural = "cupones"

    def __str__(self):
        return f"{self.marketplace.name} — {self.code}"

    @property
    def is_expired(self) -> bool:
        if not self.valid_until:
            return False
        from django.utils import timezone
        return self.valid_until < timezone.now().date()

    @property
    def discount_label(self) -> str:
        if self.discount_type == "free_shipping":
            return "Envío gratis"
        if self.discount_type == "percent" and self.discount_value:
            return f"{self.discount_value:g}% descuento"
        if self.discount_type == "fixed" and self.discount_value:
            return f"€{self.discount_value:g} de descuento"
        return self.get_discount_type_display()


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


def build_amazon_affiliate_url(url: str, tag: str = "pricearadar24-21") -> str:
    """
    Dada una URL de Amazon, devuelve la misma URL con el affiliate tag.
    Limpia parámetros de tracking y añade ?tag=pricearadar24-21
    Extrae el ASIN del path y construye URL limpia.
    """
    import re
    from urllib.parse import urlparse, urlencode, urlunparse
    try:
        parsed = urlparse(url)
        # Extraer ASIN del path — viene después de /dp/ o /gp/product/
        asin_match = re.search(r'/(?:dp|gp/product)/([A-Z0-9]{10})', parsed.path)
        if asin_match:
            asin = asin_match.group(1)
            # URL limpia con solo el tag
            clean_path = f"/dp/{asin}"
            clean_url = urlunparse((parsed.scheme, parsed.netloc, clean_path, '', f'tag={tag}', ''))
            return clean_url
        # Si no hay ASIN, añade el tag a la URL original
        params = {'tag': tag}
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{urlencode(params)}"
    except Exception:
        return url
