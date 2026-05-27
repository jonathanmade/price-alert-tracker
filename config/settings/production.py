from .base import *
import environ

env = environ.Env()

DEBUG = False

# Static files — whitenoise serves them directly from Gunicorn (no nginx needed for static)
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    *MIDDLEWARE[1:],
]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# SECRET_KEY heredada de base.py — viene siempre de env("SECRET_KEY")

# CORS: solo el dominio de producción (sobrescribe base.py)

ALLOWED_HOSTS = env.list(
    "ALLOWED_HOSTS",
    default=[".railway.app", "app.pricearadar.com"]
)

# Railway termina SSL en el proxy — Django debe confiar en el header X-Forwarded-Proto
SECURE_PROXY_SSL_HEADER    = ("HTTP_X_FORWARDED_PROTO", "https")

# HTTPS / cookies seguras
SECURE_SSL_REDIRECT        = True
SESSION_COOKIE_SECURE      = True
CSRF_COOKIE_SECURE         = True
SECURE_HSTS_SECONDS        = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD        = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS            = "DENY"
