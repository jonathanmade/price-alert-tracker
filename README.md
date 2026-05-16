# PriceRadar

Plataforma de alertas de precio para el mercado español. Los usuarios registran URLs de productos con un precio objetivo; el sistema comprueba el precio periódicamente y notifica por email y Telegram cuando baja.

**Dominio:** [pricearadar.com](https://pricearadar.com)
**Modelo de negocio:** plataforma gratuita monetizada con links de afiliado, SEO programático y Google AdSense.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Base de datos + Auth clientes | Supabase (PostgreSQL 17 + Auth) |
| API, worker y panel staff | Django 5.2 + Celery |
| Cola de tareas | Redis |
| Scraping | BeautifulSoup + Requests + Playwright (fallback Amazon) |
| Email | SendGrid |
| Notificaciones | Telegram Bot API |
| Frontend público | React + Vite + Tailwind CSS |
| Panel de gestión interna | Django Templates + Tailwind CDN |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│              FRONTEND PÚBLICO (React)                   │
│         @supabase/supabase-js  (ANON KEY)               │
└──────────────┬──────────────────────────────────────────┘
               │  Auth + CRUD directo (RLS)
               ▼
┌─────────────────────────────────────────────────────────┐
│                     SUPABASE                            │
│  ┌───────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │ Auth ES256│  │PostgREST │  │  PostgreSQL         │   │
│  │ (JWKS)    │  │ + RLS    │  │  profiles / products│   │
│  └───────────┘  └──────────┘  │  alerts / alert_urls│   │
│                               │  price_history       │   │
│                               │  credit_transactions │   │
│                               └────────────────────┘   │
└──────────────────────────────┬──────────────────────────┘
                               │  SERVICE ROLE KEY
                               ▼
┌─────────────────────────────────────────────────────────┐
│              DJANGO (API + Worker + Staff)               │
│                                                         │
│  /api/check-price/      → comprobación manual (JWT)     │
│  /api/scrape-metadata/  → detección automática de URL   │
│  /api/telegram/*        → vinculación cuenta Telegram   │
│  /staff/                → panel gestor (session auth)   │
│  /admin/                → Django admin (superusuario)   │
│                                                         │
│  Celery Beat (cada hora):                               │
│   - filtra alertas por check_time == hora actual        │
│   - scraping con BeautifulSoup (primary + alert_urls)   │
│   - guarda en price_history                             │
│   - envía email + Telegram si precio ≤ objetivo         │
│                                                         │
│  Redis (broker Celery)                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Modelo de datos

### Supabase (usuarios y alertas)
```sql
profiles            (id → auth.users, email, credits, created_at)
products            (id, user_id, name, url, current_price, last_checked_at,
                     last_scrape_status, last_scrape_error,   ← salud del scraper
                     scrape_ok_count, scrape_error_count,     ← contadores históricos
                     outbound_clicks)                         ← clics de salida
alerts              (id, user_id, product_id, target_price, status,
                     check_time TIME, triggered_at, created_at)
alert_urls          (id, alert_id, url, marketplace_label,
                     current_price, last_checked_at)          ← multi-marketplace
price_history       (id, product_id, price, checked_at)
credit_transactions (id, user_id, amount, reason, created_at)
```

### Django ORM (catálogo y monetización)
```
Marketplace      (name, slug, base_url, affiliate_tag, active)
Category         (name, slug)
ReferenceProduct (name, slug, description, image_url, category, active)
ProductURL       (product, marketplace, url, affiliate_url, current_price, active)
AffiliateClick   (product_url, ip_hash, user_agent, referer, clicked_at)
Coupon           (marketplace, code, description, discount_type,
                  discount_value, min_order, valid_until, active, verified)
TelegramAccount  (user_id UUID, chat_id, username, first_name, active)
TelegramLinkToken(user_id UUID, token, created_at)            ← TTL 15 min
```

**Estados de alerta:** `active` → `triggered` | `paused`

**Créditos:** 10 al registrarse. Cada comprobación consume 1 (independientemente del número de marketplaces).

---

## Módulos implementados

| # | Módulo | Estado |
|---|--------|--------|
| 1 | Roles y permisos (Admin / Gestor / Cliente) | ✅ Completo |
| 2 | Panel de administrador (CRUD productos, analytics) | ✅ Completo |
| 3 | Sistema de afiliación y tracking de clics | ✅ Completo |
| 4 | Comparador de marketplaces | ✅ Completo |
| 5 | SEO programático (páginas auto-generadas) | ✅ Completo |
| 6 | Historial y gráficas de precios | ✅ Completo |
| 7 | Buscador de cupones promocionales | ✅ Completo |
| 8 | Notificaciones Telegram | ✅ Completo |
| 9 | Onboarding y detección automática de producto | ✅ Completo |
| 10 | Multi-marketplace en alertas | ✅ Completo |
| 11 | Analytics del usuario | ✅ Completo |
| 12 | Scraping con Playwright (fallback Amazon) + salud del scraper | ✅ Completo |

**Pendiente:** configuración producción (nginx + Gunicorn) · deploy en priceradar.com · tests unitarios · rate limiting

---

## Estado del proyecto — análisis 2025-05-10

### Verificado y funcionando
- Django `manage.py check` — 0 errores
- Todas las migraciones Django aplicadas (✓)
- Panel staff: login, CSRF, redirección, error de credenciales
- Rutas públicas: `/comparar/`, `/cupones/` — HTTP 200
- Frontend React (Vite 8, puerto 3000): todas las rutas SPA 200
- TypeScript compila sin errores

### Bugs corregidos en esta sesión
| # | Archivo | Descripción |
|---|---------|-------------|
| 🔴 | `apps/products/tasks.py` | Reembolso de créditos sobreescribía en vez de sumar; ahora usa `credits + 1` y registra transacción |
| 🔴 | `apps/alerts/notifications.py` | `print()` reemplazado por `logger.warning/error` |
| 🟠 | `apps/products/tasks.py` | Excepción Telegram silenciosa: ahora distingue `DoesNotExist` (esperado) de errores reales (loguea con `exc_info`) |
| 🟠 | `apps/alerts/views.py` | Igual: excepción silenciosa de Telegram ahora loguea |
| 🟠 | `requirements.txt` | Añadidos paquetes faltantes: `djangorestframework`, `django-cors-headers`, `PyJWT`, `cryptography`, `gunicorn`, `whitenoise` |
| 🔵 | Renombrado global | `PriceAlert` → `PriceRadar` en 15 archivos (Python, templates, TSX, SQL, config) |

### Bugs pendientes (no bloqueantes hoy)
| Prioridad | Archivo | Descripción |
|-----------|---------|-------------|
| 🟠 P1 | `.env` | `CORS_ALLOWED_ORIGINS` no definida → usa default 5173 pero Vite corre en 3000. Añadir `CORS_ALLOWED_ORIGINS=http://localhost:3000` al `.env` |
| 🟠 P1 | `.env` | Variables `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_NAME`, `TELEGRAM_WEBHOOK_SECRET`, `FRONTEND_URL` no están en el `.env` — el bot no funcionará sin ellas |
| 🟡 P2 | `tasks.py:_deduct_credit` | Race condition: READ→UPDATE no atómico; en producción con workers paralelos puede perder créditos |
| 🟡 P2 | API endpoints | Sin rate limiting (`/api/check-price/`, `/api/scrape-metadata/`) |
| 🟡 P2 | Staff views | Queries a Supabase sin try/catch; si Supabase cae, el panel devuelve 500 |
| 🟡 P2 | Codebase | Cero tests unitarios ni de integración |
| 🔵 P3 | `.env.example` | No incluía `FRONTEND_URL`, `TELEGRAM_*` como referencias — añadir |

### Migraciones Supabase
Las 4 migraciones deben ejecutarse manualmente en Supabase SQL Editor (ver sección más abajo).
Estado en producción: verificar manualmente desde el dashboard.

---

## Roles de usuario

| Rol | Acceso | Autenticación |
|-----|--------|---------------|
| **Administrador** | `/admin/` + `/staff/` | Django session (is_superuser) |
| **Gestor de contenido** | `/staff/` | Django session (grupo `content_manager`) |
| **Usuario cliente** | Frontend React | Supabase Auth (ES256 JWT) |

Los gestores se crean manualmente desde `/admin/` asignando el grupo `content_manager`.

---

## URLs

| URL | Descripción |
|-----|-------------|
| `/` | Landing pública (React) |
| `/login` | Auth cliente via Supabase (React) |
| `/dashboard` | Panel de alertas del cliente (React) |
| `/history` | Historial de precios con gráficas (React) |
| `/analytics` | Estadísticas personales y ahorro (React) |
| `/settings/*` | Cuenta, perfil, billing, notificaciones (React) |
| `/staff/login/` | Login interno staff (Django template) |
| `/staff/` | Dashboard con stats en tiempo real |
| `/staff/products/` | Lista de productos de referencia |
| `/staff/products/new/` | Crear producto con URLs por marketplace |
| `/staff/products/<id>/edit/` | Editar producto |
| `/staff/analytics/` | Top productos, usuarios activos, stats 7d, clics afiliado |
| `/staff/coupons/` | CRUD de cupones promocionales |
| `/go/<product>/<marketplace>/` | Redirect de afiliado con tracking de clic |
| `/comparar/` | Comparador público de marketplaces |
| `/comparar/<categoria>/` | Categoría del comparador |
| `/producto/<slug>/` | Ficha pública de producto con precios |
| `/cupones/` | Buscador público de cupones |
| `/admin/` | Django admin completo |
| `/api/check-price/` | Comprobación manual (JWT required) |
| `/api/scrape-metadata/` | Detección automática nombre/precio/imagen (JWT) |
| `/api/track-outbound/` | Registra clic de salida a tienda (JWT) |
| `/api/telegram/status/` | Estado vinculación Telegram (JWT) |
| `/api/telegram/link/` | Generar enlace de vinculación (JWT) |
| `/api/telegram/unlink/` | Desvincular cuenta Telegram (JWT) |
| `/telegram/webhook/` | Webhook entrante del bot de Telegram |

---

## Estructura del proyecto

```
price-alert-tracker/
├── apps/
│   ├── users/          # Modelo User (AbstractUser + email login)
│   ├── products/       # Scraper + tarea Celery check_all_prices
│   ├── alerts/         # check_price_now, scrape_metadata, notificaciones
│   ├── catalog/        # Marketplace, Category, ReferenceProduct, Coupon
│   ├── staff/          # Panel gestor: login, dashboard, CRUD, analytics
│   └── telegram_bot/   # Bot, modelos TelegramAccount/LinkToken, webhook
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── celery.py
│   └── urls.py
├── templates/
│   ├── catalog/        # Comparador, ficha producto, cupones
│   └── staff/          # Panel gestor completo
├── frontend/           # React + Vite + Tailwind
│   └── src/
│       ├── api/        # supabase.ts, djangoApi.ts, types.ts
│       ├── components/ # AlertCard, AlertModal, PriceChart, Sidebar…
│       ├── hooks/      # useAlerts, useCredits, useHistory, useAnalytics
│       └── pages/      # Dashboard, Analytics, History, Settings, Landing…
├── supabase/
│   └── migrations/     # 001_tables_and_rls · 002_credits · 003_check_time
│                       # 004_alert_urls
├── requirements.txt
└── .env.example
```

---

## Puesta en marcha local

### Requisitos
- Python 3.11+
- Node 18+
- Redis (vía Docker)
- Cuenta en Supabase

### Backend

```bash
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # completar con tus claves
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Worker Celery

```bash
celery -A config worker -l info
celery -A config beat -l info
```

### Redis (Docker)

```bash
docker compose up redis -d
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Variables de entorno

### Backend (`.env`)

| Variable | Descripción |
|----------|-------------|
| `SECRET_KEY` | Clave secreta Django |
| `DATABASE_URL` | URI pooler Supabase |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada (solo backend) |
| `SUPABASE_JWT_SECRET` | Referencia; auth usa JWKS (ES256) |
| `REDIS_URL` | URL de Redis |
| `SENDGRID_API_KEY` | API key de SendGrid |
| `DEFAULT_FROM_EMAIL` | Email remitente |
| `CORS_ALLOWED_ORIGINS` | Orígenes permitidos (frontend URLs) |
| `FRONTEND_URL` | URL del frontend React |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram |
| `TELEGRAM_BOT_NAME` | Username del bot (sin @) |
| `TELEGRAM_WEBHOOK_SECRET` | Token secreto para validar webhooks |

### Frontend (`frontend/.env`)

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública Supabase |
| `VITE_DJANGO_API_URL` | URL del backend Django (ej: `http://localhost:8000`) |

---

## Supabase — migraciones

Ejecutar en orden en **SQL Editor** del proyecto:

| Archivo | Descripción |
|---------|-------------|
| `001_tables_and_rls.sql` | Tablas principales + RLS |
| `002_credits.sql` | Sistema de créditos |
| `003_check_time.sql` | Campo check_time en alerts |
| `004_alert_urls.sql` | Multi-marketplace (alert_urls) |
| `005_scrape_status.sql` | Estado del scraper por producto (last_scrape_status, last_scrape_error) |
| `006_product_counters.sql` | Contadores históricos (scrape_ok_count, scrape_error_count, outbound_clicks) |
| `007_security_rls.sql` | Auditoría RLS + función atómica `deduct_credit` (evita race condition) |

---

## Marketplaces preconfigurados

Amazon.es · PCComponentes · MediaMarkt · El Corte Inglés · Carrefour

---

## Notas técnicas

- **JWT ES256:** Supabase nuevos proyectos firman con ES256. La verificación usa `PyJWKClient` contra el endpoint JWKS (`/auth/v1/.well-known/jwks.json`), no el JWT secret directamente.
- **Profiles sin FK directa:** `alerts.user_id` referencia `auth.users`, no `public.profiles`. Las queries a profiles se hacen por separado con el `user_id`.
- **Multi-marketplace:** `alert_urls` almacena URLs adicionales por alerta. El worker y el endpoint manual comprueban todas las URLs consumiendo 1 solo crédito por alerta.
- **Celery schedule:** corre cada hora y filtra alertas cuyo `check_time` cae en la hora actual (zona Europe/Madrid).
- **Telegram linking:** tokens de 15 min en `TelegramLinkToken`; el bot responde a `/start <token>` para vincular la cuenta.
- **Tracking afiliado:** `AffiliateClick` guarda el IP hasheado con SHA-256 (privacidad RGPD).
- **Scraper con Playwright:** Amazon bloquea scraping básico; el sistema usa Playwright + Chromium headless como fallback para dominios Amazon. Primera llamada ~3-4 s. Requiere `playwright install chromium` tras instalar dependencias.
- **Salud del scraper:** cada intento de scraping actualiza `last_scrape_status` (`ok`/`error`) y contadores históricos en `products`. Visible en `/staff/analytics/` con tasa de éxito, tasa de rechazo, clics de precio y clics de salida por producto.
- **Precio actual en alertas:** el precio scrapeado al crear una alerta se guarda en `products.current_price` y se muestra inmediatamente en el dashboard sin esperar el primer ciclo de Celery.
- **Deploy previsto:** nginx como reverse proxy en pricearadar.com — mismo dominio para React (estáticos) y Django (API + staff).
- **Créditos atómicos:** `deduct_credit` es una función PostgreSQL (RPC Supabase) que hace UPDATE condicional en una sola query, eliminando la race condition READ→UPDATE en entornos con múltiples workers Celery.

---

## Seguridad

| Área | Estado |
|------|--------|
| Secrets en código fuente | ✅ Ninguno — todo vía `env()` / `import.meta.env` |
| `.env` en git | ✅ Ignorado por `.gitignore` |
| RLS en todas las tablas Supabase | ✅ Activo |
| Escritura en `price_history` / `credit_transactions` | ✅ Solo SERVICE ROLE (sin políticas INSERT para clientes) |
| Créditos atómicos | ✅ RPC `deduct_credit` — UPDATE condicional sin race condition |
| HTTPS en producción | ✅ `SECURE_SSL_REDIRECT`, HSTS 1 año con preload |
| Cookies seguras | ✅ `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` |
| CORS en producción | ✅ Solo `https://priceradar.com` |
| Clickjacking | ✅ `X_FRAME_OPTIONS = DENY` |
| Content-Type sniffing | ✅ `SECURE_CONTENT_TYPE_NOSNIFF` |
