# Database Report — PriceRadar

> Generado: 2026-06-01  
> Auditor: Claude Code (claude-sonnet-4-6)  
> Stack: Supabase/PostgreSQL 17 + Django ORM (misma DB vía pooler)

---

## Resumen ejecutivo

El esquema está correctamente estructurado en su núcleo: RLS activo en todas las tablas, función atómica `deduct_credit` para evitar race conditions, índices sobre las columnas más filtradas y permisos por rol bien definidos en `007_security_rls.sql`. Los riesgos más críticos se concentran en tres áreas: (1) **atomicidad rota** en `check_price_now` (view de alertas) que descuenta créditos con un UPDATE directo en lugar de la RPC atómica, dejando una ventana de race condition; (2) **crecimiento ilimitado** de `price_history` y `AffiliateClick` sin TTL, particionado ni política de retención, con queries sobre toda la tabla en producción; (3) **N+1 queries** en el bucle de `extra_urls` de las tareas Celery que emiten un UPDATE por URL adicional. Adicionalmente, el Django ORM gestiona tablas paralelas a Supabase (`products`, `alerts`) con IDs incompatibles (`BigAutoField` int vs `uuid`) y sin indices declarados, lo que puede generar inconsistencias de integridad referencial. Las migraciones Django tienen tres ficheros `initial = True` en `alerts/` con dependencias circulares potenciales entre sí.

---

## 1. Esquema y relaciones

### Hallazgos

- **[HIGH] Divergencia de tipo de PK entre Django ORM y Supabase**  
  Las tablas `products` y `alerts` en Supabase usan `uuid` como PK, pero los modelos Django (`apps/products/models.py`, `apps/alerts/models.py`) generan `BigAutoField` (entero autoincremental). Si ambos acceden a la misma base de datos, cualquier INSERT vía Django ORM producirá un ID entero en una columna declarada como `uuid`, causando un error de tipo en tiempo de ejecución o, si son bases de datos separadas, pérdida total de integridad referencial cruzada.  
  **SQL sugerido** (si se quiere unificar en UUID vía Django):
  ```python
  # models.py
  import uuid
  id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
  ```

- **[HIGH] `alerts.check_time` sin migración de valor NOT NULL**  
  La migración `003_check_time.sql` añade la columna `check_time TIME DEFAULT '09:00:00'` pero no existe equivalente en ninguna migración Django de `alerts/`. El modelo Django `Alert` tampoco declara este campo. Si se consulta `check_time` desde el ORM, se obtiene `AttributeError`; si se lee desde Supabase, la columna existe y funciona.

- **[MEDIUM] `alert_urls` sin FK a `products`**  
  La tabla `alert_urls` solo referencia `alert_id`. No hay forma directa de saber a qué producto pertenece una URL adicional sin hacer JOIN `alert_urls → alerts → products`. Un FK explícito a `products.id` o al menos un campo `product_id` desnormalizado mejoraría legibilidad y permitiría índices de cobertura.

- **[MEDIUM] `profiles` no tiene política INSERT para clientes**  
  El comentario en `007_security_rls.sql` lo documenta intencionalmente ("solo vía trigger"), pero si el trigger `on_auth_user_created` falla silenciosamente (p.ej. por un error de constraint en `email unique`), el usuario queda sin perfil y las siguientes operaciones que asuman `profiles` existente devolverán `None` o lanzarán errores en cascada en el worker y las vistas.

- **[MEDIUM] `TelegramLinkToken` sin índice en `created_at`**  
  La propiedad `is_expired` compara `created_at + 15min` pero no existe índice sobre `created_at`. Si la tabla crece (tokens no eliminados tras uso), la comprobación es O(n).

- **[LOW] `products.url` en Supabase es `text` (sin límite)**  
  El modelo Django usa `URLField(max_length=2048)` pero Supabase declara `url text not null` sin longitud máxima. Divergencia menor, pero puede aceptar URLs patológicamente largas.

- **[LOW] `unique nulls not distinct (user_id, product_id, status)` en Supabase**  
  Esta constraint en `alerts` trata los NULLs como iguales, lo que es inusual. La intención ("un usuario no puede tener dos alertas activas para el mismo producto") se logra mejor con un partial unique index, que ya existe como constraint en el ORM Django. La constraint de Supabase y la del ORM tienen semánticas sutilmente distintas; la constraint de Supabase bloquearía además tener múltiples alertas `triggered` para el mismo (user, product) si se leen los NULLs, lo cual puede ser un bug silencioso al reactivar alertas.

---

## 2. Índices faltantes

### Hallazgos

- **[HIGH] `AffiliateClick.clicked_at` — sin índice**  
  En `AnalyticsView._get()` (staff/views.py:311-312) se filtra `AffiliateClick.objects.filter(clicked_at__gte=...)`. La tabla no tiene ningún índice declarado en sus migraciones Django. Con alto volumen de clics (tabla de crecimiento ilimitado), este query hace seq-scan.  
  **SQL sugerido:**
  ```sql
  CREATE INDEX IF NOT EXISTS idx_affiliateclick_clicked_at
    ON catalog_affiliateclick (clicked_at DESC);
  ```

- **[HIGH] `AffiliateClick.product_url_id` — sin índice**  
  El agregado `Count("clicks")` en `ProductURL.objects.annotate(total_clicks=Count("clicks"))` (staff/views.py:316-320) necesita recorrer `affiliate_clicks` agrupado por `product_url_id`. Sin índice, es seq-scan sobre toda la tabla.  
  **SQL sugerido:**
  ```sql
  CREATE INDEX IF NOT EXISTS idx_affiliateclick_product_url
    ON catalog_affiliateclick (product_url_id);
  ```

- **[MEDIUM] `ProductURL.active` + `ProductURL.marketplace_id`**  
  Las vistas del catálogo hacen `.filter(active=True, marketplace_id__in=mp_ids)` repetidamente. No hay índice compuesto.  
  **SQL sugerido:**
  ```sql
  CREATE INDEX IF NOT EXISTS idx_producturl_marketplace_active
    ON catalog_producturl (marketplace_id, active)
    WHERE active = TRUE;
  ```

- **[MEDIUM] `Coupon.active` + `Coupon.valid_until`**  
  Queries en `CouponsPublicView` y `ProductPublicView` filtran `active=True` y excluyen `valid_until < today`. Sin índice parcial, se escanea toda la tabla.  
  **SQL sugerido:**
  ```sql
  CREATE INDEX IF NOT EXISTS idx_coupon_active_valid
    ON catalog_coupon (marketplace_id, valid_until)
    WHERE active = TRUE;
  ```

- **[MEDIUM] `alert_urls` — índice sobre `(alert_id, last_checked_at)` para analítica**  
  Solo existe `idx_alert_urls_alert_id`. Si se añaden queries de historial por URL, se necesitará el compuesto.

- **[LOW] `TelegramAccount.active`**  
  El worker hace `TelegramAccount.objects.get(user_id=user_id, active=True)`. Solo existe unique index en `user_id` pero no en `(user_id, active)`. El índice existente es suficiente si `active` es siempre True en uso normal, pero un índice parcial sería más limpio.

- **[INFO] Índices Supabase — cobertura correcta**  
  Los índices declarados en `001_tables_and_rls.sql` y `007_security_rls.sql` cubren adecuadamente `products(user_id)`, `alerts(user_id, product_id, status, check_time WHERE active)`, `price_history(product_id, checked_at DESC)`, `credit_transactions(user_id, created_at DESC)`, y `alert_urls(alert_id)`. No se detectan columnas frecuentemente filtradas sin índice en el lado Supabase.

---

## 3. Queries problemáticas

### Hallazgos

- **[CRITICAL] Race condition en `check_price_now` (alerts/views.py:82-103)**  
  A diferencia del worker Celery que usa la RPC atómica `deduct_credit`, la vista API `check_price_now` lee los créditos primero (`profile.get("credits", 0)`), valida (`if credits <= 0`), realiza el scraping y luego hace un UPDATE directo:
  ```python
  supabase.table("profiles").update({"credits": credits - 1}).eq("id", user_id).execute()
  ```
  Si dos peticiones concurrentes del mismo usuario llegan simultáneamente con `credits = 1`, ambas leen `credits = 1`, superan la validación y ambas descuentan, dejando `credits = -1`. La solución es usar la misma RPC atómica:
  ```python
  remaining = supabase.rpc("deduct_credit", {"p_user_id": user_id}).execute()
  if remaining.data is None:
      return JsonResponse({"error": "Sin créditos disponibles"}, status=402)
  ```

- **[HIGH] Refund de créditos con UPDATE directo — no atómico (products/tasks.py:105-112)**  
  En el bloque de error de scraping del worker, el refund se hace con:
  ```python
  supabase.table("profiles").update({
      "credits": profile.get("credits", 0) + 1
  }).eq("id", user_id).execute()
  ```
  Esto lee el valor de `credits` obtenido antes del `deduct_credit` RPC (posiblemente obsoleto si hubo otras operaciones concurrentes entre la lectura del perfil y este update). El resultado puede ser `credits` incorrecto.  
  **Solución:** Añadir una función RPC `refund_credit` o usar `UPDATE profiles SET credits = credits + 1 WHERE id = p_user_id` en lugar de leer y escribir.

- **[HIGH] N+1 UPDATE por cada `alert_url` (tasks.py:160-170, alerts/views.py:151-162)**  
  El bucle sobre `extra_urls` emite un `supabase.table("alert_urls").update(...)` individual por cada URL adicional. Con N URLs adicionales se producen N round-trips a la base de datos. En el peor caso (muchas alertas multi-marketplace), esto multiplica la carga.  
  **Solución:** Recopilar los resultados y hacer un upsert en batch, o actualizar solo cuando el precio haya cambiado.

- **[HIGH] `DashboardView` hace 5 SELECTs sin límite para contar filas (staff/views.py:72-76)**  
  ```python
  products_count = len(sb.table("products").select("id").execute().data or [])
  total_users    = len(sb.table("profiles").select("id").execute().data or [])
  ```
  Esto descarga **todas** las filas de `products` y `profiles` a Python solo para contarlas. Con crecimiento de datos es un problema de memoria y latencia severo.  
  **Solución:** Usar `count` de PostgREST:
  ```python
  result = sb.table("products").select("id", count="exact").execute()
  products_count = result.count
  ```

- **[HIGH] `AnalyticsView` descarga toda `price_history` sin límite para contar (staff/views.py:267-268)**  
  ```python
  ph_rows = sb.table("price_history").select("product_id").in_("product_id", product_ids).execute().data or []
  ```
  Si `price_history` tiene millones de filas (no hay TTL), esto transfiere todos los registros a Python. Debería ser un `COUNT GROUP BY product_id` en SQL.

- **[HIGH] `AnalyticsView` descarga todas las alertas sin límite (staff/views.py:288)**  
  ```python
  users_data = sb.table("alerts").select("user_id").execute().data or []
  ```
  Sin filtro ni límite, descarga todas las alertas de todos los usuarios para calcular el top-5. Debería delegarse a una query SQL con `GROUP BY user_id ORDER BY count DESC LIMIT 5`.

- **[MEDIUM] `track_outbound_click` tiene race condition en contadores (alerts/views.py:211-218)**  
  Lee `outbound_clicks`, suma 1 y escribe. Dos clics simultáneos pueden sobrescribirse mutuamente.  
  **Solución:** `UPDATE products SET outbound_clicks = outbound_clicks + 1 WHERE id = $1` (vía RPC o SQL directo).

- **[MEDIUM] `scrape_ok_count` / `scrape_error_count` con race condition (tasks.py:103, 121)**  
  Los contadores de scraping se leen del objeto `product` cargado al inicio de la tarea y luego se suman en Python antes de escribir. Dos tareas concurrentes para el mismo producto pisarán el contador del otro.

- **[MEDIUM] `.single()` sin manejo de `MultipleObjectsReturned` (tasks.py:69, 85; alerts/views.py:58, 76)**  
  El cliente `supabase-py` lanza `APIError` (no `MultipleObjectsReturned`) si hay más de una fila. Aunque en este schema sería raro, un error no controlado en una tarea Celery hace que la tarea falle sin reintento limpio. Estos calls están dentro de un bloque sin try/except (solo el exterior tiene `if not alert: return`).

- **[LOW] `ReferenceProduct.lowest_price` property — query por cada acceso (catalog/models.py:63-65)**  
  ```python
  prices = self.urls.filter(active=True, current_price__isnull=False).values_list(...)
  return min(prices) if prices else None
  ```
  Se ejecuta una query por cada producto renderizado en el catálogo. La vista `_catalog_context` ya usa `annotate(lowest=Min(...))`, pero si se accede a la propiedad desde una template que no usa el queryset anotado, se produce N+1.

- **[LOW] `ProductURL.click_count` property — query por cada acceso (catalog/models.py:95-96)**  
  `return self.clicks.count()` emite una query por cada `ProductURL`. En el staff `ProductDetailView` que hace `prefetch_related("urls__marketplace")`, los clics no están prefetcheados, por lo que `click_count` dispara N queries adicionales.

---

## 4. Migraciones

### Django

- **[HIGH] Tres migraciones con `initial = True` en `alerts/` (0001, 0002, 0003)**  
  Solo la primera migración de una app debe llevar `initial = True`. Las migraciones `0002_initial.py` y `0003_initial.py` en `apps/alerts/migrations/` llevan `initial = True` cuando son migraciones de alteración, no de creación. Esto puede causar que `migrate --run-syncdb` las trate incorrectamente y que herramientas de squash fallen.  
  **Acción:** Renombrar `initial = True` a `initial = False` (o eliminar el atributo) en `0002` y `0003`.

- **[HIGH] Migraciones de `products/` y `alerts/` no declaran el campo `check_time`**  
  La migración Supabase `003_check_time.sql` añade `alerts.check_time`, pero no hay ninguna migración Django correspondiente en `apps/alerts/migrations/`. El modelo `Alert` no declara `check_time`. Si el ORM Django hace queries sobre `alerts` y Supabase tiene la columna extra, la columna simplemente se ignora — pero si el modelo Django es la fuente de verdad para una futura migración, sobrescribirá el schema y eliminará la columna.

- **[HIGH] `products.last_scrape_status`, `last_scrape_error`, `scrape_ok_count`, `scrape_error_count`, `outbound_clicks` no están en los modelos Django**  
  Las migraciones Supabase `005` y `006` añaden columnas a `products`, pero el modelo Django `Product` no las tiene. El worker Celery las escribe vía Supabase client (correcto), pero si alguna vista Django accede al ORM para leer estas columnas, no estarán disponibles.

- **[MEDIUM] `alerts/0002_initial.py` — dependencia en `('products', '0001_initial')` sin `users`**  
  La migración `0002` añade `product FK`, y la `0003` añade `user FK` con `swappable_dependency`. El orden es correcto, pero si alguien ejecuta `migrate alerts` en aislamiento, `0002` depende de `products/0001` (correcto) pero `0003` depende de `alerts/0002` que ya es `initial = True` — Django puede comportarse de forma impredecible.

- **[MEDIUM] `catalog/0002_initial_marketplaces.py` no está en el repo auditado**  
  La migración `0003_affiliateclick` declara dependencia en `('catalog', '0002_initial_marketplaces')` pero ese fichero no fue listado entre los `.py` del directorio. Si contiene `RunPython` con datos de seed y no es reversible, las migraciones en testing/CI fallarán al hacer rollback.

- **[LOW] `staff/0001_create_content_manager_group.py` es reversible**  
  Tiene `reverse_code=delete_groups`, lo cual es correcto. Sin embargo, si existen usuarios asignados al grupo en producción, el `delete_groups` fallará por integridad referencial (M2M con `auth.user_groups`). Sería más seguro usar `Group.objects.filter(...).delete()` solo si no tiene usuarios.

- **[LOW] `TelegramLinkToken` no tiene campo `expires_at` en base de datos**  
  La expiración se calcula en Python como `created_at + 15min` (property `is_expired`). No hay índice ni limpieza de tokens expirados en la BD. Con el tiempo, la tabla acumula tokens obsoletos.

### Supabase

- **[MEDIUM] `003_check_time.sql` no es idempotente**  
  Usa `ALTER TABLE alerts ADD COLUMN check_time ...` sin `IF NOT EXISTS`. Si se ejecuta dos veces en el mismo entorno, fallará con `column already exists`.  
  **Corrección:**
  ```sql
  ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS check_time TIME DEFAULT '09:00:00';
  ```

- **[MEDIUM] `005_scrape_status.sql` y `006_product_counters.sql` usan `IF NOT EXISTS` en columnas — correcto, pero sin RLS ni índices para las nuevas columnas**  
  La columna `last_scrape_status` se filtra en `007_security_rls.sql` vía índice parcial (`WHERE last_scrape_status = 'error'`), lo cual está bien. Sin embargo, `outbound_clicks` no tiene índice y se actualiza con una READ+WRITE no atómica.

- **[LOW] `007_security_rls.sql` hace `DROP POLICY IF EXISTS` + `CREATE POLICY` (no idempotente para CREATE)**  
  El DROP+CREATE en un bloque no transaccional puede fallar entre el DROP y el CREATE dejando la tabla sin política activa por una fracción de tiempo. En Supabase (autocommit por defecto en el SQL editor), esto es un riesgo teórico menor. Lo correcto sería usar una transacción explícita o `CREATE OR REPLACE POLICY` (PostgreSQL 15+).

---

## 5. Crecimiento de datos y retención

### Hallazgos

- **[CRITICAL] `price_history` crece sin límite — sin TTL, sin particionado**  
  Cada comprobación de precio inserta una fila en `price_history`. Con 1.000 alertas activas que se comprueban una vez al día, la tabla acumula 365.000 filas/año por cada 1.000 usuarios. No hay ningún mecanismo de retención (no hay cron de purga, no hay particionado por `checked_at`, no hay TTL en Supabase). La query de analítica en `AnalyticsView` descarga toda la tabla sin límite.  
  **Solución recomendada:**
  ```sql
  -- Retención de 90 días vía pg_cron (o cron de Supabase)
  SELECT cron.schedule('purge-price-history', '0 3 * * *',
    $$DELETE FROM public.price_history WHERE checked_at < now() - interval '90 days'$$);
  -- O particionado por rango mensual:
  -- PARTITION BY RANGE (checked_at)
  ```

- **[HIGH] `credit_transactions` crece sin límite**  
  Similar a `price_history`, no hay política de retención. Para billing/auditoría puede ser aceptable, pero las queries de historial deben siempre incluir filtro de rango de fechas.

- **[HIGH] `AffiliateClick` (Django ORM) crece sin límite**  
  La tabla `catalog_affiliateclick` registra cada clic de afiliado. No hay purga ni archivado. Las queries de conteo en analíticas (`AffiliateClick.objects.count()`) y el filtro de 7 días harán seq-scan progresivamente más lento.  
  **Solución:** Añadir índice en `clicked_at` (ya indicado en sección 2) + purga de clics > 1 año, o desnormalizar contadores en `ProductURL`.

- **[MEDIUM] `TelegramLinkToken` acumula tokens expirados**  
  No hay limpieza de tokens expirados. Recomendable añadir una tarea periódica:
  ```python
  TelegramLinkToken.objects.filter(
      created_at__lt=timezone.now() - timedelta(minutes=15)
  ).delete()
  ```

- **[MEDIUM] `products.scrape_ok_count` / `scrape_error_count` son contadores en fila, no en tabla de series**  
  Los contadores acumulados en la fila del producto no permiten analítica temporal (p.ej. "tasa de error en los últimos 7 días"). Si se necesita esta granularidad, se requiere una tabla de series o aprovechar `price_history` con un campo `scrape_ok` booleano.

---

## 6. Atomicidad y consistencia

### Hallazgos

- **[CRITICAL] `check_price_now` (alerts/views.py:98) — UPDATE de créditos no atómico**  
  Detallado en sección 3. Es el único lugar del código que no usa la RPC `deduct_credit`. Riesgo de créditos negativos bajo concurrencia.

- **[HIGH] Refund de créditos en error de scraping (tasks.py:105-112) — UPDATE basado en valor leído previamente**  
  El valor `profile.get("credits", 0) + 1` usa el valor leído al inicio de la tarea. Si entre la lectura y el UPDATE hubo otra operación que modificó los créditos, el valor final será incorrecto (p.ej. puede sobreescribir una recarga de créditos realizada por el usuario entre medias).  
  **Solución inmediata:**
  ```sql
  -- Nueva RPC o UPDATE directo:
  UPDATE profiles SET credits = credits + 1 WHERE id = p_user_id;
  ```

- **[HIGH] `outbound_clicks` counter — race condition (alerts/views.py:215-218)**  
  ```python
  product = supabase.table("products").select("id, outbound_clicks").eq(...).single().execute().data
  supabase.table("products").update({"outbound_clicks": product.get("outbound_clicks", 0) + 1})...
  ```
  Dos clics simultáneos leerán el mismo valor y uno perderá su incremento. Solución: `UPDATE products SET outbound_clicks = outbound_clicks + 1 WHERE id = $1`.

- **[HIGH] `scrape_ok_count`/`scrape_error_count` — mismo patrón read-modify-write (tasks.py:103, 121)**  
  En tareas Celery paralelas para el mismo producto, los contadores pueden colisionar. Solución: Usar `UPDATE products SET scrape_ok_count = scrape_ok_count + 1 WHERE id = $1` vía RPC o SQL directo.

- **[MEDIUM] Inserción en `credit_transactions` fuera de transacción con `deduct_credit`**  
  En `_deduct_credit` (tasks.py:22-29), la RPC atómica descuenta el crédito, pero la inserción del registro en `credit_transactions` es una operación separada. Si la inserción falla (p.ej. timeout de red), el crédito habrá sido descontado pero no registrado en el log de auditoría. Idealmente, la RPC `deduct_credit` debería también insertar en `credit_transactions` dentro de la misma transacción PL/pgSQL.  
  **SQL sugerido** (extensión de la función existente):
  ```sql
  CREATE OR REPLACE FUNCTION public.deduct_credit(p_user_id uuid)
  RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  DECLARE v_remaining integer;
  BEGIN
    UPDATE profiles SET credits = credits - 1
    WHERE id = p_user_id AND credits > 0
    RETURNING credits INTO v_remaining;

    IF v_remaining IS NOT NULL THEN
      INSERT INTO credit_transactions (user_id, amount, reason)
      VALUES (p_user_id, -1, 'price_check');
    END IF;

    RETURN v_remaining;
  END;
  $$;
  ```

- **[LOW] No hay transacciones en operaciones multi-paso del worker**  
  La tarea `_check_single_alert` realiza en secuencia: deduct_credit → scrape → update product → insert price_history → (conditional) update alert status. No hay mecanismo de compensación si algún paso intermedio falla después de `deduct_credit`. El usuario pierde un crédito sin obtener el resultado del check. El refund solo se hace en caso de error de scraping explícito, no en caso de fallo de red en los siguientes pasos.

---

## Top 5 mejoras prioritarias

1. **Reemplazar el UPDATE de créditos directo en `check_price_now` (alerts/views.py:98) por la RPC `deduct_credit`**  
   Es el único punto que introduce race condition de créditos negativos en un endpoint síncrono de alta frecuencia. Cambio de 2 líneas de código con impacto de seguridad crítico.

2. **Implementar retención de datos en `price_history` mediante `pg_cron` o particionado por rango**  
   Sin TTL, la tabla crecerá hasta degradar todas las queries analíticas y el worker. Añadir un cron de purga de 90 días es el cambio mínimo; el particionado mensual es la solución escalable.

3. **Sustituir todos los contadores read-modify-write por UPDATE atómicos**  
   Afecta a `outbound_clicks`, `scrape_ok_count`, `scrape_error_count` y el refund de créditos. Crear una RPC genérica `increment_counter(table, column, id)` o añadir funciones RPC individuales elimina las race conditions en contadores.

4. **Añadir índices en `AffiliateClick(clicked_at)` y `AffiliateClick(product_url_id)` y mover los COUNTs del panel de analítica a queries SQL agregadas**  
   Las queries `len(sb.table(...).select("id").execute().data)` y `AffiliateClick.objects.count()` sobre tablas grandes son la causa más probable de timeout en el panel de staff en producción.

5. **Corregir las tres migraciones `initial = True` en `apps/alerts/migrations/` y añadir `IF NOT EXISTS` en `003_check_time.sql`**  
   Las migraciones mal etiquetadas pueden causar comportamientos impredecibles en CI/CD y en entornos de staging frescos. Es un cambio de una línea por archivo pero evita problemas de squash y rollback futuros.
