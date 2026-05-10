from django.urls import path
from .views import TelegramWebhookView, TelegramStatusView, TelegramLinkView, TelegramUnlinkView

urlpatterns = [
    path("webhook/",  TelegramWebhookView.as_view(), name="telegram_webhook"),
    path("status/",   TelegramStatusView.as_view(),  name="telegram_status"),
    path("link/",     TelegramLinkView.as_view(),    name="telegram_link"),
    path("unlink/",   TelegramUnlinkView.as_view(),  name="telegram_unlink"),
]
