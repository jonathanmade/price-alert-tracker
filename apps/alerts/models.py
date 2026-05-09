from django.db import models
from django.conf import settings


class Alert(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Activa"
        TRIGGERED = "triggered", "Disparada"
        PAUSED = "paused", "Pausada"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="alerts",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.CASCADE,
        related_name="alerts",
    )
    target_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE
    )
    triggered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "alerta"
        verbose_name_plural = "alertas"
        ordering = ["-created_at"]
        # un usuario no puede tener dos alertas activas para el mismo producto
        constraints = [
            models.UniqueConstraint(
                fields=["user", "product"],
                condition=models.Q(status="active"),
                name="unique_active_alert_per_user_product",
            )
        ]

    def __str__(self):
        return f"Alerta {self.product.name} ≤ {self.target_price}€ ({self.get_status_display()})"
