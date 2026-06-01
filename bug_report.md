# Bug Report — PriceRadar

## Resumen ejecutivo

Se auditaron 12 archivos del backend de PriceRadar (Django 5.2 + Celery + Supabase). Se identificaron **17 hallazgos**: 2 críticos, 5 de severidad alta, 6 medios y 4 bajos.

Los problemas más graves son dos race conditions distintas en la gestión de créditos: el endpoint `check_price_now` deduce créditos con un UPDATE no atómico (leer-modificar-escribir directo sobre `profiles.credits`), lo que permite a un usuario con 1 crédito disparar múltiples peticiones simultáneas y terminar con saldo negativo. El scraper acepta cualquier URL sin validación del esquema ni del host, exponiendo el servidor a ataques SSRF. Adicionalmente, el webhook de Telegram no verifica el secret token cuando `TELEGRAM_WEBHOOK_SECRET` no está configurado, permitiendo a cualquier actor inyectar mensajes falsos. La cobertura de tests es razonable para los flujos felices, pero carece por completo de pruebas de concurrencia, de la tarea Celery `check_all_prices`, y de los módulos de scraping con HTML real.

---

## Hallazgos por severidad

### CRITICAL

---

**[BUG-001] Race condition en deducción de créditos — `apps/alerts/views.py:82-103`**

`check_price_now` lee `profile["credits"]` y luego escribe `credits - 1` en dos operaciones separadas, sin ningún mecanismo de exclusión mutua:

```python
# views.py:82-84
credits = profile.get("credits", 0)
if credits <= 0:
    return JsonResponse(...)

# ... ~15 líneas de scraping ...

# views.py:98
supabase.table("profiles").update({"credits": credits - 1}).eq("id", user_id).execute()
```

Si el usuario envía dos peticiones simultáneas, ambas leen `credits = 1`, ambas pasan el chequeo, ambas realizan el scraping (costoso) y ambas escriben `credits = 0`, efectivamente obteniendo dos comprobaciones por el precio de una. Con `credits = 1` y N peticiones paralelas, el usuario puede conseguir N comprobaciones gratuitas.

**Fix:** Usar la RPC `deduct_credit` que ya existe en Supabase (y que ya se usa en la tarea Celery). Reemplazar las líneas 82-103 por:

```python
if not _deduct_credit(supabase, user_id):
    return JsonResponse({"error": "Sin créditos disponibles", "credits": 0}, status=402)
```

También hay que importar `_deduct_credit` desde `apps.products.tasks` o moverla a un módulo compartido.

---

**[BUG-002] SSRF: el scraper no valida el esquema ni el host de la URL — `apps/products/scraper.py:113-124` y `apps/alerts/views.py:87`**

`scrape_price` y `scrape_metadata` aceptan cualquier URL sin restricción. Un usuario autenticado puede enviar:

- `http://169.254.169.254/latest/meta-data/` (AWS IMDS) para robar credenciales de instancia
- `http://localhost:6379/` para interactuar con Redis
- `file:///etc/passwd` (si Playwright no lo bloquea)
- URLs internas de la red privada del proveedor cloud (Railway, Supabase, etc.)

```python
# scraper.py:113 — no hay validación previa
def _get_soup(url: str) -> BeautifulSoup | None:
    response = session.get(url, timeout=15, allow_redirects=True)
```

**Fix:** Añadir una función de validación antes de cualquier fetch:

```python
from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}

def _validate_url(url: str) -> bool:
    try:
        p = urlparse(url)
        if p.scheme not in ALLOWED_SCHEMES:
            return False
        host = p.hostname or ""
        # Bloquear localhost y rangos privados/linklocal
        import ipaddress
        try:
            addr = ipaddress.ip_address(host)
            if addr.is_private or addr.is_loopback or addr.is_link_local:
                return False
        except ValueError:
            pass  # hostname, no IP
        if host in ("localhost", "metadata.google.internal"):
            return False
        return bool(host)
    except Exception:
        return False
```

Llamar a `_validate_url(url)` al inicio de `scrape_price`, `scrape_metadata` y `check_price_now` antes de invocar el scraper.

---

### HIGH

---

**[BUG-003] Race condition en contadores `scrape_ok_count` / `scrape_error_count` — `apps/products/tasks.py:99-121` y `apps/alerts/views.py:89-112`**

Los contadores se incrementan con un patrón read-modify-write no atómico:

```python
# tasks.py:103
"scrape_error_count": product.get("scrape_error_count", 0) + 1,
```

Si dos tareas Celery procesan simultáneamente alertas que apuntan al mismo producto, ambas leen el valor actual y ambas escriben `valor + 1`, perdiendo un incremento. En un sistema de alertas activo, esto puede significar que las métricas de scraping son consistentemente inferiores a la realidad.

**Fix:** Usar una expresión SQL atómica. Con la API de Supabase no hay `F()` de Django, pero se puede usar un RPC o el operador de incremento de PostgREST:

```python
# En lugar del UPDATE con el valor calculado en Python,
# crear una RPC en Supabase: increment_scrape_ok(product_id) / increment_scrape_error(product_id)
# o usar raw SQL vía supabase.rpc("increment_counter", {...})
```

---

**[BUG-004] Reembolso de crédito no atómico tras error de scraping — `apps/products/tasks.py:105-107`**

Cuando el scraping falla, se hace el refund con un UPDATE directo sobre `profiles.credits`:

```python
# tasks.py:105-107
supabase.table("profiles").update({
    "credits": profile.get("credits", 0) + 1
}).eq("id", user_id).execute()
```

El valor `profile` fue leído al inicio de la tarea. Si el usuario ha consumido más créditos entre ese momento y el refund, se sobreescribe el saldo correcto con un valor obsoleto, regalando créditos al usuario.

**Fix:** Crear una RPC `refund_credit(p_user_id uuid)` en Supabase que ejecute `UPDATE profiles SET credits = credits + 1 WHERE id = p_user_id` atómicamente, igual que `deduct_credit`.

---

**[BUG-005] Webhook de Telegram sin autenticación cuando `TELEGRAM_WEBHOOK_SECRET` no está configurado — `apps/telegram_bot/views.py:22-26`**

```python
expected = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")
if expected and secret != expected:  # <-- si expected es "", la condición nunca protege
    return HttpResponse(status=403)
```

Si la variable de entorno `TELEGRAM_WEBHOOK_SECRET` no está definida (o se deja vacía), cualquier cliente puede enviar peticiones POST al endpoint del webhook y activar comandos de bot arbitrarios, incluyendo vincular cuentas de Telegram a user_ids arbitrarios mediante el flujo `/start <token>`.

**Fix:** Hacer que el secret sea obligatorio en producción, o al menos loguear una advertencia crítica al arranque. En el código del webhook, rechazar la petición si `expected` está vacío:

```python
expected = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")
if not expected or secret != expected:
    return HttpResponse(status=403)
```

---

**[BUG-006] `SUPABASE_JWT_SECRET` se carga en settings pero nunca se usa — `config/settings/base.py:117` + `apps/users/supabase_auth.py`**

```python
# base.py:117
SUPABASE_JWT_SECRET = env("SUPABASE_JWT_SECRET")  # se exige como required
```

`supabase_auth.py` usa correctamente JWKS para verificar el token (RS256/ES256), y no usa este secret en ningún punto. El problema es que la variable se declara como **obligatoria** (`env(...)` sin `default`), por lo que el servidor fallará al arrancar si no está configurada, aunque no tenga ningún efecto funcional.

**Fix:** Eliminar `SUPABASE_JWT_SECRET` de `base.py` o marcarlo como opcional con `default=""`. Verificar en todo el codebase que no existan usos ocultos.

---

**[BUG-007] `check_price_now` no verifica que la alerta pertenece al usuario autenticado — `apps/alerts/views.py:55-66`**

```python
result = supabase.table("alerts").select("*, products(...)").eq("id", alert_id).single().execute()
alert = result.data
# No hay verificación: alert["user_id"] == payload["sub"]
user_id = alert["user_id"]
```

Un usuario autenticado puede enviar el `alert_id` de otro usuario, disparar el scraping de su producto (consumiendo un crédito propio) y potencialmente activar una notificación al email/Telegram del usuario víctima. Es una fuga de información y una violación de aislamiento entre usuarios.

**Fix:** Añadir la comprobación después de cargar la alerta:

```python
if alert["user_id"] != payload["sub"]:
    return JsonResponse({"error": "No autorizado"}, status=403)
```

---

### MEDIUM

---

**[BUG-008] `_jwt_user_key` extrae el `sub` sin verificar la firma — `apps/alerts/views.py:20-29`**

La clave de rate-limiting se obtiene decodificando el JWT **sin verificar la firma**:

```python
payload = pyjwt.decode(auth[7:], options={"verify_signature": False})
return payload.get("sub", "anon")
```

Un atacante puede fabricar un JWT con cualquier `sub` para eludir el rate-limit individual. La verificación de firma sí ocurre después en `verify_supabase_token`, pero el rate-limit ya se ha aplicado (o no) con la clave fabricada. Esto permite a un atacante distribuir el rate-limit entre muchos `sub` falsos.

**Fix:** Usar la IP como fallback robusto cuando no se puede verificar el token, o mover la clave de rate-limit a _después_ de `verify_supabase_token` usando el `sub` ya verificado.

---

**[BUG-009] `scrape_metadata_view` expone SSRF sin validar el esquema de la URL — `apps/alerts/views.py:182-191`**

Similar a BUG-002, pero en el endpoint de metadatos. Cualquier usuario autenticado puede usar `scrape_metadata_view` para hacer que el servidor realice peticiones a URLs arbitrarias. Este endpoint tiene rate-limit de 20/m por IP, insuficiente si el SSRF accede a recursos internos.

**Fix:** Aplicar la misma función `_validate_url` de BUG-002 antes de llamar a `scrape_metadata`.

---

**[BUG-010] `_price_from_json_ld` solo procesa el primer item cuando `data` es una lista — `apps/products/scraper.py:133`**

```python
if isinstance(data, list):
    data = data[0]  # ignora el resto de items en el array JSON-LD
```

Algunas páginas incluyen múltiples bloques JSON-LD (p.ej. BreadcrumbList + Product). Si el Product no está en la posición 0, el precio no se extrae.

**Fix:** Iterar sobre todos los items de la lista buscando uno con `@type: "Product"` o con un campo `offers`.

---

**[BUG-011] `DashboardView` carga conteos con `len(result.data)` en lugar de usar `count` de Supabase — `apps/staff/views.py:72-75`**

```python
products_count = len(sb.table("products").select("id").execute().data or [])
total_users    = len(sb.table("profiles").select("id").execute().data or [])
```

Esto descarga todas las filas de la tabla solo para contar. Con miles de registros esto es un problema de rendimiento serio y puede causar timeouts.

**Fix:** Usar `select("id", count="exact")` y leer `result.count` directamente, que usa `SELECT COUNT(*)` en la BD.

```python
result = sb.table("products").select("id", count="exact").execute()
products_count = result.count
```

---

**[BUG-012] `check_all_prices` tiene un bug de bordes en medianoche — `apps/products/tasks.py:49-50`**

```python
if next_hour != 0:
    query = query.lt("check_time", next_hour_str)
```

Cuando `now.hour == 23`, `next_hour = 0` y no se aplica el límite superior. La query devuelve **todas las alertas con `check_time >= 23:00:00`**, incluyendo alertas de las 23:01, 23:30, etc. Esto es el comportamiento correcto para la hora 23, pero el comentario dice "midnight wrap". Sin embargo, si una alerta tiene `check_time = 23:59:00`, será procesada en el slot de las 23:00 (correcto), pero también podría ser procesada en otros slots dependiendo de cuándo se ejecute el beat. El problema real es que la query es `>= '23:00:00'` sin límite superior, incluyendo cualquier `check_time` que sea mayor que la hora actual dentro de la misma hora, no solo el rango `[23:00, 24:00)`. En realidad para `hour=22`, `next_hour=23`, el rango es `[22:00, 23:00)` correcto. El bug es sutil: a medianoche (hora 0), se consultará `>= 00:00:00` sin límite, devolviendo TODAS las alertas activas (todas tienen `check_time >= 00:00:00`).

**Fix:**

```python
if next_hour == 0:
    # rango [23:00:00, 23:59:59] para el slot de medianoche
    query = query.lt("check_time", "24:00:00")  # o usar lte("check_time", "23:59:59")
```

---

**[BUG-013] Doble disparo de notificación si la misma alerta se procesa dos veces antes del UPDATE de status — `apps/products/tasks.py:131-157`**

La alerta se marca como `"triggered"` dentro de `_trigger()`, pero si `_check_single_alert` es encolada dos veces (p.ej. por un reintento de Celery o por una ejecución de beat duplicada), la segunda ejecución también puede pasar el chequeo de `current_price <= target_price` porque el UPDATE de status puede no haberse propagado todavía. El endpoint `check_price_now` sí comprueba `alert["status"] == "active"` (línea 146), pero la tarea Celery no lo hace.

**Fix:** Añadir `and alert["status"] == "active"` en la condición de disparo de la tarea:

```python
if current_price <= float(alert["target_price"]) and alert["status"] == "active":
```

---

### LOW

---

**[BUG-014] `send_price_alert` usa `print()` en lugar de `logging` — `apps/alerts/notifications.py:9,44`**

```python
print(f"[ALERTA] {product_name}: ...")
print(f"[SendGrid error] {e}")
```

En producción con Gunicorn, `stdout` puede no estar disponible o no estar capturado por el sistema de logs. Los errores de SendGrid silenciosos son especialmente peligrosos porque el usuario no recibe la alerta y no hay trazabilidad.

**Fix:** Reemplazar por `logger = logging.getLogger(__name__)` y usar `logger.info` / `logger.error`.

---

**[BUG-015] `SUPABASE_JWT_SECRET` nunca se usa pero se exige como variable obligatoria — ver BUG-006 (componente LOW adicional)**

Además del impacto operativo (BUG-006 HIGH), este campo supone documentación engañosa: un nuevo desarrollador que lea `base.py` pensará que el JWT se verifica con HS256 usando este secret, cuando en realidad se usa JWKS con RS256/ES256. Esto puede llevar a cambios incorrectos en el futuro.

---

**[BUG-016] Import de `datetime` y `timezone` duplicado en `apps/staff/views.py:281`**

```python
# Línea 241 (arriba en el archivo, AnalyticsView._get)
from datetime import datetime, timedelta, timezone
# ... ya estaba importado en el scope local, no a nivel de módulo
```

`datetime` no está importado a nivel de módulo en `staff/views.py`, solo dentro del método `_get`. Si se añade lógica fuera de ese método que necesite `datetime`, fallará con `NameError`. El import también se repite en `catalog/views.py` dentro de métodos.

**Fix:** Mover `from datetime import datetime, timedelta, timezone` al nivel superior del módulo.

---

**[BUG-017] `requirements.txt` no fija versiones exactas — `requirements.txt`**

Todas las dependencias usan `>=` o sin versión (`playwright`, `django-ratelimit`), haciendo los builds no reproducibles. Una actualización de `supabase>=2.0` a una versión con breaking changes podría romper silenciosamente la integración en producción.

**Fix:** Generar un `requirements.txt` con versiones fijadas (`pip freeze > requirements.txt`) y mantener un `requirements.in` con las versiones mínimas para `pip-compile`.

---

## Cobertura de tests

| Módulo | Cobertura estimada | Notas |
|---|---|---|
| `scraper._extract_price` | Alta | 8 casos, incluye edge cases de formato |
| `tasks._deduct_credit` | Alta | 5 casos, mock correcto |
| `alerts.views.check_price_now` | Media | Flujos felices y errores básicos cubiertos. **Falta**: test de autenticación de alerta ajena (BUG-007), race condition de créditos (BUG-001), multi-URL con trigger |
| `alerts.views.scrape_metadata_view` | Media-baja | Solo 3 casos. **Falta**: SSRF / URL inválida, timeout del scraper |
| `alerts.views.track_outbound_click` | Media | 3 casos básicos. **Falta**: click count con race condition |
| `tasks.check_all_prices` | **0%** | No hay ningún test para la tarea principal del scheduler |
| `tasks._check_single_alert` | **0%** | No hay tests de la tarea Celery |
| `telegram_bot/views.py` | **0%** | Webhook, link, unlink sin tests |
| `users/supabase_auth.py` | **0%** | Verificación JWT sin tests |
| `catalog/views.py` | **0%** | Vistas públicas sin tests |
| `staff/views.py` | **0%** | Panel staff sin tests |

**Ausencias notables:**
- No hay tests de integración que verifiquen el flujo completo alerta → scraping → notificación
- No hay tests de concurrencia para la gestión de créditos
- No hay tests que verifiquen el comportamiento con HTML real de Amazon/MediaMarkt (solo mocks)
- No existe configuración de `pytest.ini` o `conftest.py` con fixtures compartidas para Supabase mock

---

## Top 5 fixes prioritarios

1. **[BUG-001] Reemplazar el UPDATE de créditos en `check_price_now` por la RPC `deduct_credit`** — elimina la race condition más explotable. Cambio de 5 líneas.

2. **[BUG-002 + BUG-009] Añadir `_validate_url` antes de cualquier fetch en el scraper** — cierra el vector SSRF en todos los puntos de entrada (Celery task, `check_price_now`, `scrape_metadata_view`).

3. **[BUG-007] Verificar que `alert["user_id"] == payload["sub"]` en `check_price_now`** — previene el acceso cruzado entre usuarios y el disparo de notificaciones ajenas. Cambio de 3 líneas.

4. **[BUG-005] Hacer obligatorio `TELEGRAM_WEBHOOK_SECRET` en producción** — sin esto el webhook de Telegram es abierto a cualquier actor. Cambio de 2 líneas + variable de entorno.

5. **[BUG-004] Reemplazar el refund de crédito en la tarea Celery por una RPC atómica** — evita que errores de scraping conviertan créditos en número impredecible por condición de carrera.
