-- =============================================================
-- PriceRadar — Módulo: Estado del scraper por producto
-- =============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS last_scrape_status text CHECK (last_scrape_status IN ('ok', 'error')),
  ADD COLUMN IF NOT EXISTS last_scrape_error  text;
