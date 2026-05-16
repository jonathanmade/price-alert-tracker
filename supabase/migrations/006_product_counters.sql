-- =============================================================
-- PriceRadar — Contadores de scraping y clics por producto
-- =============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS scrape_ok_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrape_error_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outbound_clicks    integer NOT NULL DEFAULT 0;
