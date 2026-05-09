# PriceAlert

Plataforma de alertas de precio para el mercado español. Los usuarios registran URLs de productos con un precio objetivo; el sistema comprueba el precio periódicamente y notifica por email cuando baja.

**Modelo de negocio:** plataforma gratuita monetizada con links de afiliado, SEO programático y Google AdSense.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Base de datos + Auth clientes | Supabase (PostgreSQL 17 + Auth) |
| API, worker y panel staff | Django 5.2 + Celery |
| Cola de tareas | Redis |
| Scraping | BeautifulSoup + Requests |
| Email | SendGrid |
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
│  └───────────┘  └──────────┘  │  alerts / history   │   │
│                               │  credit_transactions │   │
│                               └────────────────────┘   │
└──────────────────────────────┬──────────────────────────┘
                               │  SERVICE ROLE KEY
                               ▼
┌─────────────────────────────────────────────────────────┐
│              DJANGO (API + Worker + Staff)               │
│                                                         │
│  /api/check-price/   → comprobación manual (JWT ES256)  │
│  /staff/             → panel gestor (session auth)      │
│  /admin/             → Django admin (superusuario)      │
│                                                         │
│  Celery Beat (cada hora):                               │
│   - filtra alertas por check_time == hora actual        │
│   - scraping con BeautifulSoup                          │
│   - guarda en price_history                             │
│   - envía email si precio ≤ objetivo (SendGrid)         │
│                                                         │
│  Redis (broker Celery)                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Modelo de datos

```sql
profiles          (id → auth.users, email, credits, created_at)
products          (id, user_id, name, url, current_price, last_checked_at)
alerts            (id, user_id, product_id, target_price, status,
                   check_time TIME, triggered_at, created_at)
price_history     (id, product_id, price, checked_at)
credit_transactions (id, user_id, amount, reason, created_at)
```

**Estados de alerta:** `active` → `triggered` | `paused`

**Créditos:** 10 al registrarse. Cada comprobación consume 1.

---

## Módulos (plan de desarrollo)

| # | Módulo | Estado |
|---|--------|--------|
| 1 | Roles y permisos (Admin / Gestor / Cliente) | ✅ Completo |
| 2 | Panel de administrador (CRUD productos, analytics) | 🔜 Siguiente |
| 3 | Sistema de afiliación y tracking de clics | ⬜ Pendiente |
| 4 | Comparador de marketplaces | ⬜ Pendiente |
| 5 | SEO programático (páginas auto-generadas) | ⬜ Pendiente |
| 6 | Historial y gráficas de precios | ✅ Completo |
| 7 | Buscador de cupones promocionales | ⬜ Pendiente |
| 8 | Notificaciones Telegram | ⬜ Pendiente |

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
| `/settings/*` | Cuenta, perfil, billing (React) |
| `/staff/login/` | Login interno staff (Django template) |
| `/staff/` | Dashboard staff con stats (Django template) |
| `/admin/` | Django admin completo |
| `/api/check-price/` | API comprobación manual (JWT required) |

---

## Estructura del proyecto

```
price-alert-tracker/
├── apps/
│   ├── users/          # Modelo User (AbstractUser + email login)
│   ├── products/       # Scraper + tarea Celery check_all_prices
│   ├── alerts/         # Vista check_price_now + notificaciones
│   └── staff/          # Panel gestor: login, dashboard, mixins
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── celery.py
│   └── urls.py
├── templates/
│   └── staff/          # base.html, login.html, dashboard.html
├── frontend/           # React + Vite + Tailwind
│   └── src/
│       ├── api/        # supabase.ts, djangoApi.ts, types.ts
│       ├── components/ # AlertCard, AlertModal, PriceChart, UserMenu…
│       ├── hooks/      # useAlerts, useCredits
│       └── pages/      # Dashboard, Landing, Settings, History…
├── supabase/
│   └── migrations/     # SQL aplicado en Supabase
├── requirements.txt
└── .env.example
```

---

## Puesta en marcha local

### Requisitos
- Python 3.11+
- Node 18+
- Redis (vía Docker o instalado)
- Cuenta en Supabase

### Backend

```bash
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # completar con tus claves
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8001
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

| Variable | Descripción |
|----------|-------------|
| `SECRET_KEY` | Clave secreta Django |
| `DATABASE_URL` | URI pooler Supabase (`aws-0-eu-west-1.pooler.supabase.com`) |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave pública (frontend React) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada (Django backend) |
| `SUPABASE_JWT_SECRET` | Solo referencia; auth usa JWKS (ES256) |
| `REDIS_URL` | URL de Redis |
| `SENDGRID_API_KEY` | API key de SendGrid |
| `DEFAULT_FROM_EMAIL` | Email remitente |
| `CORS_ALLOWED_ORIGINS` | Orígenes permitidos (frontend URLs) |

---

## Marketplaces objetivo

España y Cataluña: Amazon.es · PCComponentes · MediaMarkt · El Corte Inglés · Carrefour

---

## Notas técnicas

- **JWT ES256:** Supabase nuevos proyectos firman con ES256. La verificación usa `PyJWKClient` contra el endpoint JWKS (`/auth/v1/.well-known/jwks.json`), no el JWT secret directamente.
- **Profiles sin FK directa:** `alerts.user_id` referencia `auth.users`, no `public.profiles`. Las queries a profiles se hacen por separado con el `user_id`.
- **Celery schedule:** corre cada hora y filtra alertas cuyo `check_time` cae en la hora actual (zona Europe/Madrid).
