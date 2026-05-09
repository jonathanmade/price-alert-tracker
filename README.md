# PriceAlert

SaaS de alertas de precios. El usuario registra URLs de productos y un precio objetivo; el sistema revisa periódicamente el precio y notifica por email cuando baja.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Base de datos + Auth | Supabase (PostgreSQL 17) |
| API y worker | Django 5.2 + Celery |
| Cola de tareas | Redis |
| Scraping | BeautifulSoup + Requests |
| Email | SendGrid |
| Frontend | React + Vite + Tailwind CSS |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                            │
│              React + Vite + Tailwind                    │
│         @supabase/supabase-js  (ANON KEY)               │
└──────────────┬──────────────────────────────────────────┘
               │  Auth + CRUD directo
               ▼
┌─────────────────────────────────────────────────────────┐
│                     SUPABASE                            │
│  ┌───────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │ Auth      │  │PostgREST │  │  PostgreSQL         │   │
│  │ (JWT)     │  │ REST API │  │  users / products   │   │
│  │           │  │ + RLS    │  │  alerts / history   │   │
│  └───────────┘  └──────────┘  └────────────────────┘   │
└──────────────────────────────┬──────────────────────────┘
                               │  SERVICE ROLE KEY
                               ▼
┌─────────────────────────────────────────────────────────┐
│               WORKER (Django + Celery)                  │
│                                                         │
│  Tarea periódica (cada hora)                            │
│  1. Lee alertas activas de Supabase                     │
│  2. Hace scraping con BeautifulSoup                     │
│  3. Guarda precio en historial                          │
│  4. Si precio ≤ objetivo → envía email por SendGrid     │
│  5. Actualiza estado de alerta a "triggered"            │
│                                                         │
│  Redis (broker de tareas)                               │
└─────────────────────────────────────────────────────────┘
```

---

## Modelo de datos

```sql
profiles        (id → auth.users, email, created_at)
products        (id, user_id, name, url, current_price, last_checked_at, created_at)
alerts          (id, user_id, product_id, target_price, status, triggered_at, created_at)
price_history   (id, product_id, price, checked_at)
```

**Estados de una alerta:** `active` → `triggered` | `paused`

---

## UX / UI

**Paleta:** Indigo (`#4F46E5`) sobre fondo gris claro (`#F9FAFB`)
**Navegación:** Sidebar lateral
**Nueva alerta:** Modal emergente

### Pantallas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing con CTA directo |
| `/login` `/register` | Auth via Supabase |
| `/dashboard` | Lista de alertas activas |
| `/products/:id` | Detalle + historial de precios (gráfico) |
| `/history` | Alertas disparadas |
| `/settings` | Configuración de cuenta |

### Estructura frontend

```
frontend/
├── src/
│   ├── api/           # llamadas a Supabase
│   ├── components/
│   │   ├── layout/    # Sidebar, Layout
│   │   ├── alerts/    # AlertCard, AlertModal, AlertList
│   │   └── ui/        # Button, Badge, Modal
│   ├── pages/         # Dashboard, History, ProductDetail, Settings
│   ├── hooks/         # useAlerts, useProducts
│   └── router.tsx
├── tailwind.config.js
└── vite.config.ts
```

---

## Estructura del proyecto

```
price-alert-tracker/
├── apps/
│   ├── users/         # Modelo User personalizado
│   ├── products/      # Modelo Product + scraping
│   └── alerts/        # Modelo Alert + lógica de notificación
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── celery.py
│   └── urls.py
├── frontend/          # React app (próximamente)
├── docker-compose.yml
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

| Variable | Descripción |
|----------|-------------|
| `SECRET_KEY` | Clave secreta Django |
| `DATABASE_URL` | URI de conexión a Supabase PostgreSQL |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave pública (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada (worker Django) |
| `REDIS_URL` | URL de Redis |
| `SENDGRID_API_KEY` | API key de SendGrid |
| `DEFAULT_FROM_EMAIL` | Email remitente de notificaciones |

---

## Roadmap

- [x] Setup Django + conexión Supabase
- [x] Modelos: User, Product, Alert
- [x] Migraciones aplicadas en Supabase
- [ ] Políticas RLS en Supabase
- [ ] Frontend React + autenticación
- [ ] Tarea Celery de scraping
- [ ] Notificaciones por email (SendGrid)
- [ ] Gráfico de historial de precios
- [ ] Deploy (Railway / Render)
