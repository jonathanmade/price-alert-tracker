import requests
from django.conf import settings

_API = "https://api.telegram.org/bot{token}/{method}"


def _call(method: str, **payload) -> dict:
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    if not token:
        return {"ok": False, "description": "TELEGRAM_BOT_TOKEN not set"}
    url = _API.format(token=token, method=method)
    try:
        resp = requests.post(url, json=payload, timeout=10)
        return resp.json()
    except Exception as e:
        return {"ok": False, "description": str(e)}


def send_message(chat_id: int, text: str, parse_mode: str = "HTML") -> dict:
    return _call("sendMessage", chat_id=chat_id, text=text, parse_mode=parse_mode)


def send_alert(chat_id: int, product_name: str, product_url: str,
               current_price: float, target_price: float) -> dict:
    text = (
        f"🔔 <b>¡Precio alcanzado!</b>\n\n"
        f"📦 <b>{product_name}</b>\n"
        f"💶 Precio actual: <b>€{current_price:.2f}</b>\n"
        f"🎯 Tu objetivo: €{target_price:.2f}\n\n"
        f'<a href="{product_url}">Ver producto →</a>'
    )
    return send_message(chat_id, text)


def set_webhook(webhook_url: str, secret_token: str = "") -> dict:
    return _call("setWebhook", url=webhook_url, secret_token=secret_token)


def delete_webhook() -> dict:
    return _call("deleteWebhook")


def get_me() -> dict:
    return _call("getMe")
