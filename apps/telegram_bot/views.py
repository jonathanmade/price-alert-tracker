import json
import secrets

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from apps.users.supabase_auth import verify_supabase_token
from .bot import send_message
from .models import TelegramAccount, TelegramLinkToken


# ── Telegram webhook ──────────────────────────────────────────────────────────

@method_decorator(csrf_exempt, name="dispatch")
class TelegramWebhookView(View):
    """Recibe actualizaciones de Telegram. Registrado via set_telegram_webhook."""

    def post(self, request):
        # Verifica el secret token opcional
        secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        expected = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")
        if expected and secret != expected:
            return HttpResponse(status=403)

        try:
            update = json.loads(request.body)
        except Exception:
            return HttpResponse(status=400)

        message = update.get("message") or {}
        text       = message.get("text", "").strip()
        chat       = message.get("chat", {})
        from_user  = message.get("from", {})
        chat_id    = chat.get("id")
        username   = from_user.get("username", "")
        first_name = from_user.get("first_name", "Hola")

        if not chat_id:
            return HttpResponse("ok")

        if text.startswith("/start "):
            self._handle_start_with_token(chat_id, text.split(" ", 1)[1].strip(), username, first_name)
        elif text == "/start":
            send_message(
                chat_id,
                f"👋 ¡Hola, {first_name}! Soy el bot de <b>PriceAlert</b>.\n\n"
                "Para conectar tu cuenta ve a <b>Ajustes → Notificaciones</b> "
                "en PriceAlert y pulsa «Conectar Telegram».",
            )
        elif text == "/stop":
            self._handle_stop(chat_id)
        elif text == "/estado":
            self._handle_status(chat_id)
        else:
            send_message(
                chat_id,
                "Comandos disponibles:\n"
                "• /estado — ver si tu cuenta está conectada\n"
                "• /stop — desactivar notificaciones",
            )

        return HttpResponse("ok")

    @staticmethod
    def _handle_start_with_token(chat_id, token_str, username, first_name):
        try:
            link_token = TelegramLinkToken.objects.get(token=token_str)
        except TelegramLinkToken.DoesNotExist:
            send_message(chat_id, "❌ Enlace no válido. Genera uno nuevo desde tu perfil en PriceAlert.")
            return

        if link_token.is_expired:
            link_token.delete()
            send_message(chat_id, "⏱️ Este enlace ha caducado (15 min). Genera uno nuevo desde tu perfil.")
            return

        TelegramAccount.objects.update_or_create(
            user_id=link_token.user_id,
            defaults={
                "chat_id":    chat_id,
                "username":   username,
                "first_name": first_name,
                "active":     True,
            },
        )
        link_token.delete()
        send_message(
            chat_id,
            f"✅ <b>¡Cuenta conectada, {first_name}!</b>\n\n"
            "A partir de ahora recibirás aquí las alertas cuando el precio "
            "de un producto baje a tu objetivo.\n\n"
            "Usa /stop para desactivar las notificaciones en cualquier momento.",
        )

    @staticmethod
    def _handle_stop(chat_id):
        updated = TelegramAccount.objects.filter(chat_id=chat_id, active=True).update(active=False)
        if updated:
            send_message(chat_id, "🔕 Notificaciones desactivadas. Puedes reactivarlas desde tu perfil en PriceAlert.")
        else:
            send_message(chat_id, "No tengo ninguna cuenta vinculada a este chat.")

    @staticmethod
    def _handle_status(chat_id):
        if TelegramAccount.objects.filter(chat_id=chat_id, active=True).exists():
            send_message(chat_id, "✅ Tu cuenta está conectada. Recibirás alertas de precio por aquí.")
        else:
            send_message(chat_id, "❌ No tienes la cuenta vinculada o está desactivada.")


# ── API para el frontend React ────────────────────────────────────────────────

class TelegramStatusView(View):
    """GET /api/telegram/status/ — devuelve si el usuario tiene Telegram vinculado."""

    def get(self, request):
        payload = verify_supabase_token(request)
        if not payload:
            return JsonResponse({"error": "No autorizado"}, status=401)

        user_id = payload.get("sub")
        try:
            account = TelegramAccount.objects.get(user_id=user_id, active=True)
            return JsonResponse({
                "linked":     True,
                "username":   account.username,
                "first_name": account.first_name,
                "linked_at":  account.linked_at.isoformat(),
            })
        except TelegramAccount.DoesNotExist:
            return JsonResponse({"linked": False})


class TelegramLinkView(View):
    """POST /api/telegram/link/ — genera un enlace de vinculación de 15 min."""

    def post(self, request):
        payload = verify_supabase_token(request)
        if not payload:
            return JsonResponse({"error": "No autorizado"}, status=401)

        user_id = payload.get("sub")

        if TelegramAccount.objects.filter(user_id=user_id, active=True).exists():
            return JsonResponse({"error": "Tu cuenta ya está vinculada a Telegram."}, status=400)

        token_obj, _ = TelegramLinkToken.objects.update_or_create(
            user_id=user_id,
            defaults={"token": secrets.token_urlsafe(32)},
        )

        bot_name = getattr(settings, "TELEGRAM_BOT_NAME", "")
        link_url = f"https://t.me/{bot_name}?start={token_obj.token}"

        return JsonResponse({"link_url": link_url, "expires_in": 900})


class TelegramUnlinkView(View):
    """POST /api/telegram/unlink/ — desvincula la cuenta."""

    def post(self, request):
        payload = verify_supabase_token(request)
        if not payload:
            return JsonResponse({"error": "No autorizado"}, status=401)

        user_id = payload.get("sub")
        updated = TelegramAccount.objects.filter(user_id=user_id).update(active=False)
        if updated:
            return JsonResponse({"ok": True})
        return JsonResponse({"error": "No hay cuenta vinculada."}, status=404)
