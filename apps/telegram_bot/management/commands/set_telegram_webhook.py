from django.core.management.base import BaseCommand, CommandError
from apps.telegram_bot.bot import set_webhook, get_me


class Command(BaseCommand):
    help = "Registra el webhook de Telegram para recibir actualizaciones"

    def add_arguments(self, parser):
        parser.add_argument(
            "domain",
            help="Dominio público, ej: https://pricealert.es",
        )
        parser.add_argument(
            "--secret",
            default="",
            help="Secret token para validar las peticiones de Telegram (recomendado)",
        )

    def handle(self, *args, **options):
        domain = options["domain"].rstrip("/")
        webhook_url = f"{domain}/telegram/webhook/"
        secret = options["secret"]

        # Verify bot token works
        me = get_me()
        if not me.get("ok"):
            raise CommandError(f"Error con el token del bot: {me.get('description')}")

        bot_info = me.get("result", {})
        self.stdout.write(f"Bot: @{bot_info.get('username')} ({bot_info.get('first_name')})")

        result = set_webhook(webhook_url, secret_token=secret)
        if result.get("ok"):
            self.stdout.write(self.style.SUCCESS(f"✓ Webhook registrado: {webhook_url}"))
        else:
            raise CommandError(f"Error al registrar webhook: {result.get('description')}")
