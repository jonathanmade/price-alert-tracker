-- =============================================================
-- PriceRadar — Snapshot completo de seguridad RLS
-- =============================================================
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Este archivo es la fuente de verdad del estado de seguridad.
-- Consolida las políticas de todas las migraciones anteriores,
-- añade REVOKE/GRANT explícitos por rol y define la función
-- atómica deduct_credit (elimina race condition en créditos).
--
-- Es idempotente: usa CREATE POLICY IF NOT EXISTS /
-- CREATE OR REPLACE donde aplica.
-- =============================================================


-- =============================================================
-- SECCIÓN 1 — PERMISOS A NIVEL DE TABLA POR ROL
-- =============================================================
-- Supabase concede por defecto SELECT/INSERT/UPDATE/DELETE
-- a los roles `anon` y `authenticated` en tablas públicas.
-- RLS restringe el acceso fila a fila, pero como defensa en
-- profundidad revocamos permisos de tabla donde no son necesarios.


-- anon: sin acceso a ninguna tabla de datos de usuario
REVOKE ALL ON public.profiles             FROM anon;
REVOKE ALL ON public.products             FROM anon;
REVOKE ALL ON public.alerts               FROM anon;
REVOKE ALL ON public.alert_urls           FROM anon;
REVOKE ALL ON public.price_history        FROM anon;
REVOKE ALL ON public.credit_transactions  FROM anon;

-- authenticated: acceso completo a sus propias tablas (RLS aplica)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_urls          TO authenticated;

-- authenticated: solo lectura en tablas escritas por el backend
GRANT SELECT ON public.price_history       TO authenticated;
GRANT SELECT ON public.credit_transactions TO authenticated;

-- service_role: acceso total (bypass RLS por diseño en Supabase)
GRANT ALL ON public.profiles             TO service_role;
GRANT ALL ON public.products             TO service_role;
GRANT ALL ON public.alerts               TO service_role;
GRANT ALL ON public.alert_urls           TO service_role;
GRANT ALL ON public.price_history        TO service_role;
GRANT ALL ON public.credit_transactions  TO service_role;


-- =============================================================
-- SECCIÓN 2 — ROW LEVEL SECURITY ACTIVO EN TODAS LAS TABLAS
-- =============================================================

ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_urls           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions  ENABLE ROW LEVEL SECURITY;


-- =============================================================
-- SECCIÓN 3 — POLÍTICAS POR TABLA
-- =============================================================

-- -------------------------------------------------------------
-- 3.1  profiles
-- -------------------------------------------------------------
-- INSERT: solo via trigger on_auth_user_created (security definer)
-- No hay política INSERT para clientes → no pueden insertar perfiles.

DROP POLICY IF EXISTS "Perfil propio: lectura"  ON public.profiles;
DROP POLICY IF EXISTS "Perfil propio: edicion"  ON public.profiles;

CREATE POLICY "Perfil propio: lectura"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Perfil propio: edicion"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Sin política DELETE: los usuarios no pueden borrar su perfil
-- (se borra en cascada cuando auth.users se elimina desde Supabase Auth)


-- -------------------------------------------------------------
-- 3.2  products
-- -------------------------------------------------------------

DROP POLICY IF EXISTS "Productos propios: lectura"   ON public.products;
DROP POLICY IF EXISTS "Productos propios: insercion" ON public.products;
DROP POLICY IF EXISTS "Productos propios: edicion"   ON public.products;
DROP POLICY IF EXISTS "Productos propios: borrado"   ON public.products;

CREATE POLICY "Productos propios: lectura"
  ON public.products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Productos propios: insercion"
  ON public.products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Productos propios: edicion"
  ON public.products FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Productos propios: borrado"
  ON public.products FOR DELETE
  USING (auth.uid() = user_id);


-- -------------------------------------------------------------
-- 3.3  alerts
-- -------------------------------------------------------------

DROP POLICY IF EXISTS "Alertas propias: lectura"   ON public.alerts;
DROP POLICY IF EXISTS "Alertas propias: insercion" ON public.alerts;
DROP POLICY IF EXISTS "Alertas propias: edicion"   ON public.alerts;
DROP POLICY IF EXISTS "Alertas propias: borrado"   ON public.alerts;

CREATE POLICY "Alertas propias: lectura"
  ON public.alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Alertas propias: insercion"
  ON public.alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Alertas propias: edicion"
  ON public.alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Alertas propias: borrado"
  ON public.alerts FOR DELETE
  USING (auth.uid() = user_id);


-- -------------------------------------------------------------
-- 3.4  alert_urls  (multi-marketplace)
-- -------------------------------------------------------------

DROP POLICY IF EXISTS "alert_urls: lectura"   ON public.alert_urls;
DROP POLICY IF EXISTS "alert_urls: insercion" ON public.alert_urls;
DROP POLICY IF EXISTS "alert_urls: edicion"   ON public.alert_urls;
DROP POLICY IF EXISTS "alert_urls: borrado"   ON public.alert_urls;

CREATE POLICY "alert_urls: lectura"
  ON public.alert_urls FOR SELECT
  USING (
    alert_id IN (
      SELECT id FROM public.alerts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "alert_urls: insercion"
  ON public.alert_urls FOR INSERT
  WITH CHECK (
    alert_id IN (
      SELECT id FROM public.alerts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "alert_urls: edicion"
  ON public.alert_urls FOR UPDATE
  USING (
    alert_id IN (
      SELECT id FROM public.alerts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "alert_urls: borrado"
  ON public.alert_urls FOR DELETE
  USING (
    alert_id IN (
      SELECT id FROM public.alerts WHERE user_id = auth.uid()
    )
  );


-- -------------------------------------------------------------
-- 3.5  price_history  — SOLO LECTURA para clientes
-- -------------------------------------------------------------
-- Escritura exclusiva del backend (SERVICE ROLE KEY).
-- No hay política INSERT/UPDATE/DELETE → clientes no pueden escribir.

DROP POLICY IF EXISTS "Historial: lectura de productos propios" ON public.price_history;

CREATE POLICY "Historial: lectura de productos propios"
  ON public.price_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id      = price_history.product_id
        AND products.user_id = auth.uid()
    )
  );


-- -------------------------------------------------------------
-- 3.6  credit_transactions  — SOLO LECTURA para clientes
-- -------------------------------------------------------------
-- Escritura exclusiva del backend (SERVICE ROLE KEY).
-- No hay política INSERT/UPDATE/DELETE → clientes no pueden escribir.

DROP POLICY IF EXISTS "Transacciones propias: lectura" ON public.credit_transactions;

CREATE POLICY "Transacciones propias: lectura"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);


-- =============================================================
-- SECCIÓN 4 — FUNCIÓN ATÓMICA deduct_credit
-- =============================================================
-- Elimina la race condition READ→UPDATE del worker Celery.
-- UPDATE condicional en una sola operación de base de datos:
--   · Si credits > 0 → descuenta 1, devuelve créditos restantes
--   · Si credits = 0 → no modifica nada, devuelve NULL
--
-- Uso desde Python (supabase-py):
--   result = supabase.rpc("deduct_credit", {"p_user_id": user_id}).execute()
--   if result.data is None:
--       # sin créditos — abortar
--
-- Solo service_role puede ejecutar esta función.

CREATE OR REPLACE FUNCTION public.deduct_credit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining integer;
BEGIN
  UPDATE profiles
  SET    credits = credits - 1
  WHERE  id      = p_user_id
    AND  credits > 0
  RETURNING credits INTO v_remaining;

  RETURN v_remaining;  -- NULL si no hubo actualización (sin créditos)
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_credit(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.deduct_credit(uuid) TO service_role;


-- =============================================================
-- SECCIÓN 5 — ÍNDICES DE RENDIMIENTO Y SEGURIDAD
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_products_user_id
  ON public.products (user_id);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id
  ON public.alerts (user_id);

CREATE INDEX IF NOT EXISTS idx_alerts_product_id
  ON public.alerts (product_id);

CREATE INDEX IF NOT EXISTS idx_alerts_status
  ON public.alerts (status);

CREATE INDEX IF NOT EXISTS idx_alerts_check_time
  ON public.alerts (check_time)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_price_history_product
  ON public.price_history (product_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user
  ON public.credit_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_urls_alert_id
  ON public.alert_urls (alert_id);

CREATE INDEX IF NOT EXISTS idx_products_scrape_status
  ON public.products (last_scrape_status)
  WHERE last_scrape_status = 'error';
