# CLAUDE.md — Contexto del proyecto PriceRadar

Este archivo es leído automáticamente por Claude Code al inicio de cada sesión.
Contiene las reglas, arquitectura y convenciones del proyecto. **Léelo completo antes de tocar cualquier archivo.**

---

## 🏗️ Arquitectura general

PriceRadar es un tracker de precios con alertas. Tiene dos partes desacopladas:

### Backend — Django 5.2
- API REST con Django REST Framework
- Autenticación de usuarios vía **Supabase Auth** (JWT/JWKS) — Django NO gestiona usuarios
- Base de datos: **Supabase Postgres** (compartida dev y prod por ahora)
- Cola de tareas: **Celery + Redis** (Upstash en producción)
- Servido con **Gunicorn** en Railway
- Static files con **Whitenoise**

### Frontend — React 19 + Vite + TypeScript
- Desplegado en **Vercel**
- Tailwind CSS v4
- Cliente Supabase JS para auth y queries directas a BD

### Staff Panel — Django templates
- Autenticación propia vía Supabase (no Django admin)
- Dark theme con Tailwind CDN
- Solo accesible desde el dominio de Railway (no Vercel)

---

## 🌍 Dominios y servicios

| Entorno | Frontend (Vercel) | Backend/Staff (Railway) |
|---------|-------------------|------------------------|
| **Prod** | `www.pricearadar.com` | `app.pricearadar.com` |
| **Dev** | `dev.pricearadar.com` | `app-dev.pricearadar.com` |

- **Supabase**: proyecto único compartido entre dev y prod (por ahora)
- **Resend**: emails transaccionales desde `noreply@pricearadar.com`
- **Doppler**: gestión de variables de entorno (sincroniza con Railway)
- **Cloudflare**: DNS y proxy para todos los dominios

---

## 🚨 REGLAS QUE NUNCA DEBES ROMPER

### 1. NUNCA toques `frontend/vercel.json`
Este archivo solo debe contener el catch-all del SPA:
```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
**No añadas rewrites a Railway.** El staff panel vive en `app-dev.pricearadar.com`, no en `dev.pricearadar.com`. Añadir rewrites causa errores de certificado SSL.

### 2. NUNCA hardcodees URLs de dominios en el código
Usa variables de entorno/settings:
- `settings.STAFF_BASE_URL` para URLs del staff panel
- `settings.FRONTEND_URL` para URLs del frontend
- Nunca: `"https://app.pricearadar.com/..."` directamente en el código

### 3. NUNCA mezcles tipos uuid y bigint en joins SQL
- Tablas Supabase (users, alerts, products, price_history): usan `uuid`
- Tablas Django/catalog (catalog_referenceproduct, catalog_producturl, etc.): usan `bigint`
- No hagas JOIN directo entre ambas sin cast explícito

### 4. NUNCA uses SELECT + UPDATE separados para operaciones de créditos
Usa siempre el RPC atómico de Supabase:
```python
result = supabase.rpc("deduct_credit", {"p_user_id": user_id}).execute()
```

### 5. Siempre verifica ownership en queries de alertas
```python
.eq("id", alert_id).eq("user_id", payload["sub"])
```

---

## 📁 Estructura del proyecto

```
price-alert-tracker/
├── apps/
│   ├── alerts/          # Alertas de precio de usuarios
│   ├── catalog/         # Catálogo público de productos (staff)
│   ├── products/        # Productos y scraping
│   ├── staff/           # Panel de gestión interno (Django templates)
│   ├── telegram_bot/    # Notificaciones Telegram
│   └── users/           # Auth vía Supabase
├── config/
│   └── settings/
│       ├── base.py
│       ├── development.py
│       └── production.py
├── frontend/            # React app (Vercel)
│   ├── src/
│   │   ├── api/         # Cliente Supabase y tipos TS
│   │   ├── components/
│   │   ├── hooks/
│   │   └── pages/
│   └── vercel.json      # ⚠️ NO TOCAR
├── static/              # Static files de Django
├── supabase/
│   └── migrations/      # SQL ejecutado en Supabase
└── templates/
    └── staff/           # Templates del staff panel
```

---

## 🔧 Apps Django y sus responsabilidades

| App | Responsabilidad |
|-----|----------------|
| `apps.alerts` | CRUD de alertas, check de precios, notificaciones |
| `apps.catalog` | Catálogo público: ReferenceProduct, ProductURL, Marketplace |
| `apps.products` | Scraping, price_history de usuarios, tasks Celery |
| `apps.staff` | Panel interno: auth, dashboard, gestión de catálogo |
| `apps.users` | Middleware JWT, verificación de tokens Supabase |

### Afiliación Amazon
- **Affiliate tag**: `pricearadar24-21`
- **Helper**: `build_amazon_affiliate_url(url, tag)` en `apps/catalog/models.py` — extrae el ASIN del path y construye URL limpia `https://www.amazon.es/dp/ASIN?tag=pricearadar24-21`
- **Auto-generación**: en `ProductCreateView` y `ProductEditView` del staff panel, si el staff deja `affiliate_url` vacío para Amazon, se genera automáticamente

---

## 🗄️ Tablas principales en Supabase

### Tablas de usuarios (uuid):
- `profiles` — datos de usuario, créditos
- `products` — productos trackeados por usuarios
- `alerts` — alertas de precio
- `price_history` — historial de precios de productos de usuarios
- `credit_transactions` — log de créditos
- `featured_products` — (deprecated, usar landing_featured_products view)

### Tablas del catálogo Django (bigint):
- `catalog_referenceproduct` — productos del catálogo público
- `catalog_producturl` — URLs por marketplace de cada producto
- `catalog_marketplace` — Amazon, MediaMarkt, etc.
- `catalog_category` — categorías de productos
- `catalog_price_history` — historial de precios del catálogo

### Views públicas (anon puede leer):
- `landing_featured_products` — productos featured para la landing

### RPCs importantes:
- `deduct_credit(p_user_id)` — descuenta 1 crédito atómicamente
- `refund_credit(p_user_id)` — reembolsa 1 crédito

---

## ⚙️ Variables de entorno clave

Gestionadas en Doppler, sincronizadas con Railway:

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
DATABASE_URL              # Supabase Postgres connection string
REDIS_URL                 # Upstash Redis
SECRET_KEY                # Django secret key
ALLOWED_HOSTS             # Dominios permitidos por Django
STAFF_EMAILS              # Emails autorizados como staff (comma-separated)
STAFF_BASE_URL            # https://app.pricearadar.com (prod) / https://app-dev.pricearadar.com (dev)
FRONTEND_URL              # https://www.pricearadar.com (prod) / https://dev.pricearadar.com (dev)
DJANGO_SETTINGS_MODULE    # config.settings.production en Railway
```

---

## 🌿 Flujo de trabajo con Git

```
main   → Railway prod + Vercel prod (www / app)
dev    → Railway dev  + Vercel dev  (dev / app-dev)
```

- Trabajar siempre en rama `dev`
- PR a `main` solo cuando dev está estable y probado
- Commits en español o inglés, formato: `tipo(scope): descripción`
  - `feat`, `fix`, `chore`, `docs`, `refactor`

---

## 🔄 Celery tasks programadas

| Task | Schedule | Descripción |
|------|----------|-------------|
| `products.check_all_prices` | Cada hora | Scrape alertas activas de usuarios |
| `catalog.check_catalog_prices` | Cada 6h | Scrape productos featured del catálogo |

---

## 🖥️ Staff panel — convenciones de templates

- Dark theme: `bg-slate-950` (body), `bg-slate-900` (cards)
- Inputs: `bg-slate-800 border border-white/10`
- Botón primario: `bg-indigo-600 hover:bg-indigo-500`
- Bordes: `border-white/5`
- Textos secundarios: `text-slate-500`
- Todos los templates sin base.html usan Tailwind CDN
- Los templates que extienden base.html usan `{% load static %}`

### Endpoints API del staff panel

| Método | URL | Vista | Descripción |
|--------|-----|-------|-------------|
| `POST` | `/staff/users/invite/` | `InviteUserView` | Invita usuario via Supabase Admin API. Parámetros: `email`, `is_staff` (opcional). Si `is_staff=on`, asigna `app_metadata.is_staff=True`. Devuelve JSON `{ok, email, is_staff}`. |

### Módulos del staff panel

| Template | Vista | URL | Bloque nav activo |
|----------|-------|-----|-------------------|
| `staff/dashboard.html` | `DashboardView` | `/staff/` | `nav_dashboard` |
| `staff/products/list.html` | `ProductListView` | `/staff/products/` | `nav_products` |
| `staff/products/form.html` | `ProductCreateView` / `ProductEditView` | `/staff/products/new/` | `nav_products` |
| `staff/analytics.html` | `AnalyticsView` | `/staff/analytics/` | `nav_analytics` |
| `staff/coupons/list.html` | `CouponListView` | `/staff/coupons/` | `nav_coupons` |
| `staff/users/list.html` | `UserListView` | `/staff/users/` | `nav_users` |
| — | `InviteUserView` | `POST /staff/users/invite/` | — |
| `staff/login.html` | `StaffLoginView` | `/staff/login/` | — |
| `staff/password_reset.html` | `StaffPasswordResetView` | `/staff/password-reset/` | — |
| `staff/password_reset_confirm.html` | `StaffPasswordResetConfirmView` | `/staff/password-reset/confirm/` | — |

---

## 🖋️ Frontend React — convenciones

- TypeScript estricto — siempre tipar correctamente
- Supabase client en `frontend/src/api/supabase.ts`
- Tipos en `frontend/src/api/types.ts`
- Hooks en `frontend/src/hooks/`
- Componentes UI reutilizables en `frontend/src/components/ui/`
- Verificar siempre con `npx tsc --noEmit` antes de dar tarea por terminada

---

## 📧 Emails

- Proveedor: **Resend** (dominio verificado: pricearadar.com)
- Remitente: `noreply@pricearadar.com`
- Emails de auth (reset, confirmación): gestionados por Supabase via SMTP de Resend
- Emails de alertas de precio: gestionados por Django via SendGrid (apps/alerts/notifications.py)

---

## 🗺️ Hoja de ruta

| # | Módulo | Estado |
|---|--------|--------|
| 1 | Roles y permisos | ✅ Hecho |
| 2 | Panel admin + Productos | ✅ Hecho |
| 3 | Auth completa (reset password) | ✅ Hecho |
| 4 | Landing dinámica con reel | 🔄 En progreso |
| 5 | Historial y gráficas catálogo | 🔄 En progreso |
| 6 | Módulo de usuarios y estadísticas | 🔄 En progreso |
| 7 | Afiliación | ⏳ Pendiente |
| 8 | Cupones | ⏳ Pendiente |
| 9 | Comparador de precios | ⏳ Pendiente |
| 10 | SEO programático | ⏳ Pendiente |
| 11 | Telegram | ⏳ Pendiente |

---

## ⚠️ Problemas conocidos / pendientes

- `staticfiles/` warning en Railway — carpeta no existe en el contenedor
- Dev y prod comparten la misma BD Supabase (separar en el futuro)
- `catalog_price_history` recién creada — sparklines reales disponibles después del primer scrape del catálogo
- Email unsubscribe link pendiente en alertas de precio
- **Amazon scraping bloqueado** por captcha en Railway (IPs de datacenter) — el scraper devuelve None para URLs de Amazon
- **Pendiente Amazon PA API** — requiere 10 ventas/30 días como Associate para acceso; hasta entonces el precio no se actualiza para alertas de Amazon
- **Affiliate tag configurado**: `pricearadar24-21` — se auto-aplica en el staff panel al crear/editar productos del catálogo
