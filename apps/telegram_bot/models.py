import secrets
from django.db import models


class TelegramAccount(models.Model):
    user_id    = models.UUIDField(unique=True)   # Supabase auth.users UUID
    chat_id    = models.BigIntegerField(unique=True)
    username   = models.CharField(max_length=100, blank=True)
    first_name = models.CharField(max_length=100, blank=True)
    linked_at  = models.DateTimeField(auto_now_add=True)
    active     = models.BooleanField(default=True)

    class Meta:
        verbose_name = "cuenta Telegram"
        verbose_name_plural = "cuentas Telegram"

    def __str__(self):
        handle = f"@{self.username}" if self.username else self.first_name
        return f"{handle} → {self.user_id}"


class TelegramLinkToken(models.Model):
    user_id    = models.UUIDField(unique=True)
    token      = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "token de vinculación Telegram"

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        from django.utils import timezone
        from datetime import timedelta
        return timezone.now() > self.created_at + timedelta(minutes=15)
