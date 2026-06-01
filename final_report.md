# Final Report — PriceRadar
> Auditoría completa · Rama `main` · commit `95a1f3c` · 2026-06-01

---

## Resumen ejecutivo

PriceRadar es una plataforma de alertas de precio madura, con arquitectura bien pensada: RLS activo en Supabase, autenticación ES256 via JWKS, función atómica `deduct_credit` y 27 tests unitarios. El stack es sólido (Django 5.2 + Celery + Supabase + React/Vite/Tailwind) pero la auditoría reveló **39 hallazgos** distribuidos en tres áreas. Los más críticos son dos: (1) la race condition de créditos en el endpoint `check_price_now` (el único punto del sistema que no usa la RPC atómica), y (2) una vulnerabilidad SSRF por la que cualquier usuario autenticado puede usar el scraper para acceder a recursos internos del servidor. Adicionalmente, el webhook de Telegram queda desprotegido si `TELEGRAM_WEBHOOK_SECRET` está vacío, la tabla `price_history` crece sin retención ni TTL, y el frontend tiene dos sistemas de diseño paralelos sin tokens compartidos. La buena noticia: la mayoría de los fixes son cambios de 2-5 líneas sobre infraestructura que ya existe.

---

## Top 5 acciones prioritarias por impacto

| # | Acción | Severidad | Esfuerzo | Archivos afectados |
|---|--------|-----------|----------|--------------------|
| **1** | **Reemplazar UPDATE directo de créditos en `check_price_now` por RPC `deduct_credit`** | CRITICAL | 30 min | `apps/alerts/views.py:82-103` |
| **2** | **Añadir validación de URL antes de cualquier fetch del scraper (anti-SSRF)** | CRITICAL | 2h | `apps/products/scraper.py`, `apps/alerts/views.py` |
| **3** | **Corregir webhook Telegram: rechazar si `TELEGRAM_WEBHOOK_SECRET` está vacío** | HIGH | 15 min | `apps/telegram_bot/views.py:24` |
| **4** | **Añadir `IF NOT EXISTS` en `003_check_time.sql` + corregir `initial=True` en 3 migraciones** | HIGH | 30 min | `supabase/migrations/003_check_time.sql`, `apps/alerts/migrations/` |
| **5** | **Implementar retención de `price_history` con pg_cron (90 días) + sustituir `len(data)` por `count="exact"`** | CRITICAL + HIGH | 2h | `supabase/migrations/` (nueva), `apps/staff/views.py` |

---

## Matriz de hallazgos por subagente y severidad

| Severidad | Design & UX | Bug Hunting | Base de Datos | **Total** |
|-----------|:-----------:|:-----------:|:-------------:|:---------:|
| CRITICAL  | 2           | 2           | 3             | **7**     |
| HIGH      | 8           | 5           | 9             | **22**    |
| MEDIUM    | 10          | 6           | 9             | **25**    |
| LOW       | 6           | 4           | 6             | **16**    |
| **Total** | **26**      | **17**      | **27**        | **70**    |

> Nota: algunos hallazgos están correlacionados entre subagentes (p.ej. la race condition de créditos aparece en Bug y en DB con perspectivas distintas). Se listan por separado porque cada uno aporta contexto adicional.

---

## Hallazgos por subagente

### Subagente 1 — Design & UX

| ID | Severidad | Hallazgo | Archivo |
|----|-----------|---------|---------|
| D-01 | CRITICAL | Botón "Eliminar cuenta" hace `signOut` en lugar de borrar datos — posible incumplimiento RGPD | `Account.tsx:131` |
| D-02 | CRITICAL | `AlertModal` sin `role="dialog"`, `aria-modal` ni trampa de foco | `AlertModal.tsx:113-118` |
| D-03 | HIGH | Dos sistemas de diseño paralelos (Landing CSS vars + Tailwind) sin `tailwind.config.js` | `Landing.css` vs resto de la app |
| D-04 | HIGH | Fuentes `Sora` y `DM Sans` referenciadas pero nunca importadas | `Landing.css:38-39` |
| D-05 | HIGH | `AlertModal.tsx` sin debounce en `scrapeMetadata` al cambiar URL — peticiones solapadas | `AlertModal.tsx:70` |
| D-06 | HIGH | Sin warning cuando precio objetivo ≥ precio actual (la alerta nunca se disparará) | `AlertModal.tsx` |
| D-07 | HIGH | `Analytics.tsx`, `History.tsx`, `Settings.tsx` con `px-8` fijo sin breakpoint móvil | 3 archivos |
| D-08 | HIGH | Panel staff (`staff/base.html`) sin responsividad — sidebar fijo 256px | `templates/staff/base.html` |
| D-09 | HIGH | Tailwind cargado via CDN (~4MB) en todas las plantillas Django | `staff/base.html:7`, `catalog/base.html:32` |
| D-10 | HIGH | Botón hamburguesa accesible, pero overlay de cierre no accesible por teclado | `AppLayout.tsx:12-20` |
| D-11 | HIGH | Botones "Eliminar" en `AlertCard` sin `aria-label` contextual | `AlertCard.tsx:219` |
| D-12 | HIGH | Spinners de carga sin `role="status"` ni `aria-label` | `Dashboard.tsx:17` y otros |
| D-13 | MEDIUM | Función `domainLabel(url)` duplicada en dos archivos | `AlertCard.tsx:23`, `AlertModal.tsx:26` |
| D-14 | MEDIUM | Botones de acción en `AlertCard` con área táctil < 44px | `AlertCard.tsx:206-224` |
| D-15 | MEDIUM | Tabs de `Settings.tsx` sin `role="tablist"`/`role="tab"` | `Settings.tsx:22-37` |
| D-16 | MEDIUM | Landing: nav-links oculta en móvil sin menú hamburguesa alternativo | `Landing.css` |
| D-17 | MEDIUM | `History.tsx`: estado vacío sin CTA para crear alerta | `History.tsx:53-59` |
| D-18 | MEDIUM | Flujo vinculación Telegram — pasos visualmente discontinuos | `Notifications.tsx:103-128` |
| D-19 | MEDIUM | Sin confirmación accesible en acciones destructivas del panel staff | `staff/products/form.html` |
| D-20 | MEDIUM | Nombre de marca inconsistente en 4 superficies ("PriceRadar", "Price-A-Radar", "PriceAlert") | `Landing.tsx`, `Sidebar.tsx`, `staff/base.html` |
| D-21 | MEDIUM | `og:image` vacío por defecto en catálogo Django — mal CTR en redes sociales | `catalog/base.html:22` |
| D-22 | MEDIUM | Precios sin formateo de decimales en panel staff (`€219` vs `€219.00`) | `staff/dashboard.html:86` |
| D-23 | LOW | Copyright hardcodeado `© 2025` en footer | `catalog/base.html:59` |
| D-24 | LOW | Mensaje de "Comprobar ahora" desaparece en 6s — muy rápido para usuarios lentos | `AlertCard.tsx:49` |
| D-25 | LOW | Íconos SVG del `Sidebar` sin `aria-hidden="true"` | `Sidebar.tsx` |
| D-26 | LOW | Color de diferencia de precio comunicado solo por color (daltonismo) | `AlertCard.tsx:147-156` |

---

### Subagente 2 — Bug Hunting & Calidad

| ID | Severidad | Hallazgo | Archivo |
|----|-----------|---------|---------|
| B-01 | CRITICAL | Race condition: `check_price_now` descuenta créditos con UPDATE no atómico | `alerts/views.py:82-103` |
| B-02 | CRITICAL | SSRF: scraper acepta cualquier URL sin validar esquema/host | `scraper.py:113`, `alerts/views.py:87` |
| B-03 | HIGH | Contadores `scrape_ok/error_count` con read-modify-write no atómico | `tasks.py:99-121` |
| B-04 | HIGH | Refund de crédito en error de scraping sobreescribe saldo con valor obsoleto | `tasks.py:105-107` |
| B-05 | HIGH | Webhook Telegram sin auth cuando `TELEGRAM_WEBHOOK_SECRET` está vacío | `telegram_bot/views.py:22-26` |
| B-06 | HIGH | `SUPABASE_JWT_SECRET` requerido pero nunca usado (JWKS ES256) | `config/settings/base.py:117` |
| B-07 | HIGH | `check_price_now` no verifica que la alerta pertenece al usuario autenticado | `alerts/views.py:55-66` |
| B-08 | MEDIUM | `_jwt_user_key` extrae `sub` sin verificar firma JWT — rate-limit bypasseable | `alerts/views.py:20-29` |
| B-09 | MEDIUM | `scrape_metadata_view` también expone SSRF (mismo vector que B-02) | `alerts/views.py:182-191` |
| B-10 | MEDIUM | `_price_from_json_ld` solo procesa el primer item si `data` es array | `scraper.py:133` |
| B-11 | MEDIUM | `DashboardView` usa `len(result.data)` para contar filas — descarga completa | `staff/views.py:72-75` |
| B-12 | MEDIUM | Bug de medianoche: hora 0 devuelve TODAS las alertas activas | `tasks.py:49-50` |
| B-13 | MEDIUM | Doble disparo de notificación si la tarea Celery se encola dos veces | `tasks.py:131-157` |
| B-14 | LOW | `send_price_alert` usa `print()` en lugar de `logging` | `notifications.py:9,44` |
| B-15 | LOW | `SUPABASE_JWT_SECRET` crea documentación engañosa sobre algoritmo de verificación | `base.py` |
| B-16 | LOW | Import de `datetime` solo dentro de métodos, no a nivel de módulo | `staff/views.py:281`, `catalog/views.py` |
| B-17 | LOW | `requirements.txt` sin versiones fijadas — builds no reproducibles | `requirements.txt` |

**Cobertura de tests:** `check_all_prices`, `_check_single_alert`, `telegram_bot/views.py`, `users/supabase_auth.py`, `catalog/views.py` y `staff/views.py` tienen **cobertura 0%**.

---

### Subagente 3 — Base de Datos & Datos

| ID | Severidad | Hallazgo | Archivo/Tabla |
|----|-----------|---------|---------------|
| DB-01 | CRITICAL | Race condition créditos en `check_price_now` — UPDATE directo (no RPC) | `alerts/views.py:98` |
| DB-02 | CRITICAL | `price_history` crece sin límite — sin TTL, particionado ni purga | `supabase/migrations/` |
| DB-03 | CRITICAL | `AnalyticsView` descarga toda `price_history` y todas las `alerts` sin límite | `staff/views.py:267-288` |
| DB-04 | HIGH | Refund de créditos con UPDATE basado en valor leído previamente — no atómico | `tasks.py:105-112` |
| DB-05 | HIGH | N+1 UPDATEs por cada `alert_url` en el worker | `tasks.py:160-170` |
| DB-06 | HIGH | `DashboardView`: 5 SELECTs completos solo para contar filas | `staff/views.py:72-76` |
| DB-07 | HIGH | `credit_transactions` crece sin límite ni retención | `credit_transactions` |
| DB-08 | HIGH | `AffiliateClick` sin índices en `clicked_at` ni `product_url_id` | `catalog_affiliateclick` |
| DB-09 | HIGH | `AffiliateClick` crece sin límite ni archivado | `catalog_affiliateclick` |
| DB-10 | HIGH | Divergencia PK: Supabase usa `uuid`, Django ORM genera `BigAutoField` (int) | `apps/products/models.py`, `apps/alerts/models.py` |
| DB-11 | HIGH | Tres migraciones `initial=True` en `apps/alerts/migrations/` | `0001`, `0002`, `0003` en `alerts/` |
| DB-12 | HIGH | `check_time`, `last_scrape_status`, `scrape_ok_count` existen en Supabase pero no en modelos Django | `apps/alerts/models.py`, `apps/products/models.py` |
| DB-13 | MEDIUM | `alert_urls` sin FK a `products` — JOIN doble requerido | `alert_urls` |
| DB-14 | MEDIUM | `profiles` sin INSERT policy — si el trigger falla, cascada de errores | `007_security_rls.sql` |
| DB-15 | MEDIUM | `TelegramLinkToken` sin índice en `created_at` ni limpieza de tokens expirados | `telegram_bot/models.py` |
| DB-16 | MEDIUM | `outbound_clicks` con race condition read-modify-write | `alerts/views.py:211-218` |
| DB-17 | MEDIUM | `scrape_ok/error_count` con race condition en tareas paralelas | `tasks.py:103,121` |
| DB-18 | MEDIUM | `.single()` sin manejo de `APIError` en múltiples puntos | `tasks.py:69,85`, `alerts/views.py:58,76` |
| DB-19 | MEDIUM | Inserción en `credit_transactions` fuera de la transacción `deduct_credit` | `tasks.py:24-29` |
| DB-20 | MEDIUM | `003_check_time.sql` no es idempotente (`IF NOT EXISTS` faltante) | `supabase/migrations/003` |
| DB-21 | MEDIUM | `scrape_ok/error_count` acumulados no permiten analítica temporal | `products` tabla |
| DB-22 | LOW | `products.url` en Supabase es `text` sin longitud máxima vs `URLField(max_length=2048)` en Django | `001_tables_and_rls.sql` |
| DB-23 | LOW | `unique nulls not distinct` puede bloquear alertas re-activadas | `alerts` constraint |
| DB-24 | LOW | `007_security_rls.sql`: DROP+CREATE de políticas no es idempotente en error | `007_security_rls.sql` |
| DB-25 | LOW | `staff/0001` migration: `delete_groups` puede fallar si usuarios están asignados | `staff/migrations/0001` |
| DB-26 | LOW | `TelegramLinkToken.is_expired` calculado en Python sin campo `expires_at` en BD | `telegram_bot/models.py` |
| DB-27 | LOW | `ReferenceProduct.lowest_price` y `ProductURL.click_count` como properties — N+1 si no están anotados | `catalog/models.py:63-65,95-96` |

---

## Próximos pasos sugeridos con estimaciones de esfuerzo

### Sprint 1 — Seguridad crítica (1-2 días)

| Tarea | Esfuerzo | Fix |
|-------|----------|-----|
| Reemplazar UPDATE directo de créditos en `check_price_now` por `deduct_credit` RPC | 30 min | `views.py:98` → `supabase.rpc("deduct_credit", ...)` |
| Añadir `_validate_url()` anti-SSRF en scraper y endpoints | 2h | Nueva función en `scraper.py`, llamada en 3 puntos |
| Corregir webhook Telegram: `if not expected or secret != expected` | 15 min | `telegram_bot/views.py:24` |
| Verificar `alert["user_id"] == payload["sub"]` en `check_price_now` | 15 min | `alerts/views.py:66` |
| Corregir eliminación de cuenta en `Account.tsx` (RGPD) | 2h | Nuevo endpoint Django + llamada desde frontend |

### Sprint 2 — Rendimiento y datos (2-3 días)

| Tarea | Esfuerzo | Fix |
|-------|----------|-----|
| Sustituir `len(data)` por `count="exact"` en `DashboardView` y `AnalyticsView` | 1h | `staff/views.py:72-76, 267-288` |
| Añadir cron de purga `price_history` (90 días via pg_cron) | 2h | Nueva migración Supabase |
| Añadir índices en `AffiliateClick(clicked_at, product_url_id)` | 30 min | Nueva migración Django |
| Refund de créditos atómico: nueva RPC `refund_credit` en Supabase | 1h | Nueva función SQL + llamada en `tasks.py` |
| Contadores atómicos: `outbound_clicks`, `scrape_ok/error_count` via RPC | 2h | 3 nuevas RPCs o UPDATE directo SQL |
| Integrar `credit_transactions` dentro de `deduct_credit` RPC | 1h | `007_security_rls.sql` actualizado |

### Sprint 3 — Calidad y diseño (3-5 días)

| Tarea | Esfuerzo | Fix |
|-------|----------|-----|
| Crear `frontend/tailwind.config.js` con tokens unificados y eliminar `Landing.css` | 1 día | Unifica sistema de diseño |
| Accesibilidad: `role="dialog"` + foco trap en `AlertModal`, `role="status"` en spinners | 3h | `AlertModal.tsx`, `Dashboard.tsx` y otros |
| Arreglar padding responsive en `Analytics`, `History`, `Settings` | 30 min | `px-4 sm:px-8` en 3 archivos |
| Compilar Tailwind estático para plantillas Django (eliminar CDN) | 4h | `staff/base.html`, `catalog/base.html` |
| Corregir migraciones: `initial=True` en `0002`/`0003` de alerts + `IF NOT EXISTS` en `003_check_time.sql` | 30 min | `apps/alerts/migrations/`, `supabase/migrations/003` |
| Fix bug medianoche en `check_all_prices` (hora 0) | 15 min | `tasks.py:49-50` |
| Fix `SUPABASE_JWT_SECRET` como obligatoria (eliminar o hacer opcional) | 15 min | `config/settings/base.py:117` |
| Añadir tests para `check_all_prices`, `_check_single_alert`, `supabase_auth.py` | 2 días | Cobertura 0% actual |
| Fijar versiones en `requirements.txt` con `pip-compile` | 30 min | `requirements.txt` |

---

*Generado automáticamente por 3 subagentes especializados + consolidación · Claude Code (claude-sonnet-4-6)*
