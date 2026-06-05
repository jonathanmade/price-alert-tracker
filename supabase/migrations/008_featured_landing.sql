-- =============================================================
-- PriceRadar — Productos destacados en landing + historial real
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =============================================================


-- -------------------------------------------------------------
-- 1. COLUMNA featured EN catalog_referenceproduct
-- -------------------------------------------------------------

ALTER TABLE public.catalog_referenceproduct
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_catalog_referenceproduct_featured
  ON public.catalog_referenceproduct (featured)
  WHERE featured = true AND active = true;


-- -------------------------------------------------------------
-- 2. TABLA catalog_price_history
-- -------------------------------------------------------------
-- Historial de precios del catálogo. product_url_id es bigint
-- (FK lógica a catalog_producturl — mismo tipo, sin FK real
-- para no acoplar migraciones Django con Supabase).

CREATE TABLE IF NOT EXISTS public.catalog_price_history (
  id              bigserial PRIMARY KEY,
  product_url_id  bigint NOT NULL,          -- catalog_producturl.id
  product_id      bigint NOT NULL,          -- catalog_referenceproduct.id (denormalizado para queries rápidas)
  price           numeric(10,2) NOT NULL,
  checked_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.catalog_price_history IS
  'Historial de precios del catálogo público. Escrito por el task Celery catalog.scrape_catalog_prices.';

CREATE INDEX IF NOT EXISTS idx_catalog_ph_product_id
  ON public.catalog_price_history (product_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_ph_product_url_id
  ON public.catalog_price_history (product_url_id, checked_at DESC);


-- -------------------------------------------------------------
-- 3. RLS en catalog_price_history
-- -------------------------------------------------------------

ALTER TABLE public.catalog_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_price_history: lectura pública" ON public.catalog_price_history;
CREATE POLICY "catalog_price_history: lectura pública"
  ON public.catalog_price_history FOR SELECT
  TO anon, authenticated
  USING (true);

-- Solo service_role puede escribir
REVOKE INSERT, UPDATE, DELETE ON public.catalog_price_history FROM anon, authenticated;
GRANT  SELECT                  ON public.catalog_price_history TO anon, authenticated;
GRANT  ALL                     ON public.catalog_price_history TO service_role;
GRANT  USAGE, SELECT           ON SEQUENCE public.catalog_price_history_id_seq TO service_role;


-- -------------------------------------------------------------
-- 4. RLS EN TABLAS DJANGO DEL CATÁLOGO
-- -------------------------------------------------------------

ALTER TABLE public.catalog_referenceproduct  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_producturl        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_marketplace       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_category          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_referenceproduct: lectura pública featured" ON public.catalog_referenceproduct;
CREATE POLICY "catalog_referenceproduct: lectura pública featured"
  ON public.catalog_referenceproduct FOR SELECT
  TO anon, authenticated
  USING (featured = true AND active = true);

DROP POLICY IF EXISTS "catalog_producturl: lectura pública" ON public.catalog_producturl;
CREATE POLICY "catalog_producturl: lectura pública"
  ON public.catalog_producturl FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND product_id IN (
      SELECT id FROM public.catalog_referenceproduct
      WHERE featured = true AND active = true
    )
  );

DROP POLICY IF EXISTS "catalog_marketplace: lectura pública" ON public.catalog_marketplace;
CREATE POLICY "catalog_marketplace: lectura pública"
  ON public.catalog_marketplace FOR SELECT
  TO anon, authenticated
  USING (active = true);

DROP POLICY IF EXISTS "catalog_category: lectura pública" ON public.catalog_category;
CREATE POLICY "catalog_category: lectura pública"
  ON public.catalog_category FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT ALL ON public.catalog_referenceproduct TO service_role;
GRANT ALL ON public.catalog_producturl       TO service_role;
GRANT ALL ON public.catalog_marketplace      TO service_role;
GRANT ALL ON public.catalog_category         TO service_role;


-- -------------------------------------------------------------
-- 5. FUNCIÓN is_all_time_low (reutilizable)
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.catalog_is_all_time_low(
  p_product_id bigint,
  p_current_price numeric
)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    p_current_price <= MIN(price),
    false
  )
  FROM public.catalog_price_history
  WHERE product_id = p_product_id;
$$;

GRANT EXECUTE ON FUNCTION public.catalog_is_all_time_low(bigint, numeric) TO anon, authenticated;


-- -------------------------------------------------------------
-- 6. VIEW PÚBLICA landing_featured_products
-- -------------------------------------------------------------

DROP VIEW IF EXISTS public.landing_featured_products;

CREATE VIEW public.landing_featured_products AS
WITH

-- Precio mínimo actual por producto (tienda más barata ahora)
best_price AS (
  SELECT DISTINCT ON (pu.product_id)
    pu.product_id,
    pu.id                 AS product_url_id,
    pu.current_price      AS current_price,
    pu.affiliate_url,
    m.name                AS store_name,
    m.slug                AS store_slug
  FROM public.catalog_producturl pu
  JOIN public.catalog_marketplace m ON m.id = pu.marketplace_id
  WHERE pu.active = true
    AND pu.current_price IS NOT NULL
  ORDER BY pu.product_id, pu.current_price ASC
),

-- Precio máximo actual entre tiendas (para % descuento)
max_price AS (
  SELECT
    product_id,
    MAX(current_price) AS original_price
  FROM public.catalog_producturl
  WHERE active = true AND current_price IS NOT NULL
  GROUP BY product_id
),

-- Sparkline: últimos 30 precios del historial real, del más antiguo al más reciente
sparkline AS (
  SELECT
    product_id,
    array_agg(price ORDER BY checked_at ASC) AS sparkline_data
  FROM (
    SELECT product_id, price, checked_at,
           ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY checked_at DESC) AS rn
    FROM public.catalog_price_history
  ) ranked
  WHERE rn <= 30
  GROUP BY product_id
),

-- Mínimo histórico real desde catalog_price_history
all_time_low AS (
  SELECT
    product_id,
    MIN(price) AS min_ever
  FROM public.catalog_price_history
  GROUP BY product_id
)

SELECT
  rp.id,
  rp.name,
  rp.slug,
  rp.image_url,
  cat.name                                          AS category,
  cat.slug                                          AS category_slug,
  bp.current_price,
  mp.original_price,
  CASE
    WHEN mp.original_price > 0 AND bp.current_price IS NOT NULL
    THEN ROUND(((mp.original_price - bp.current_price) / mp.original_price * 100))::integer
    ELSE 0
  END                                               AS discount_pct,
  bp.store_name,
  bp.store_slug,
  COALESCE(bp.affiliate_url, '')                    AS affiliate_url,
  -- Sparkline real si hay historial, si no: precios actuales por tienda como fallback
  COALESCE(
    sp.sparkline_data,
    (SELECT array_agg(current_price ORDER BY marketplace_id)
     FROM public.catalog_producturl
     WHERE product_id = rp.id AND active = true AND current_price IS NOT NULL),
    ARRAY[]::numeric[]
  )                                                 AS sparkline_data,
  -- is_all_time_low real: true si precio actual = mínimo histórico
  COALESCE(
    bp.current_price <= atl.min_ever,
    false
  )                                                 AS is_all_time_low,
  rp.updated_at

FROM public.catalog_referenceproduct rp
LEFT JOIN public.catalog_category cat ON cat.id         = rp.category_id
LEFT JOIN best_price              bp  ON bp.product_id  = rp.id
LEFT JOIN max_price               mp  ON mp.product_id  = rp.id
LEFT JOIN sparkline               sp  ON sp.product_id  = rp.id
LEFT JOIN all_time_low            atl ON atl.product_id = rp.id
WHERE rp.featured = true
  AND rp.active   = true
ORDER BY discount_pct DESC NULLS LAST;

GRANT SELECT ON public.landing_featured_products TO anon, authenticated;

COMMENT ON VIEW public.landing_featured_products IS
  'Vista pública para el reel de la landing.
   sparkline_data: últimos 30 precios reales de catalog_price_history (fallback a precios actuales).
   is_all_time_low: true cuando current_price = mínimo histórico real.';
