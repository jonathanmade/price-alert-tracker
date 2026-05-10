-- =============================================================
-- PriceAlert — Módulo 10: URLs adicionales por alerta (multi-marketplace)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.alert_urls (
  id                uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id          uuid    REFERENCES public.alerts(id) ON DELETE CASCADE NOT NULL,
  url               text    NOT NULL,
  marketplace_label text    NOT NULL DEFAULT '',
  current_price     numeric(10,2),
  last_checked_at   timestamptz,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.alert_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_urls: lectura"
  ON public.alert_urls FOR SELECT
  USING (alert_id IN (SELECT id FROM public.alerts WHERE user_id = auth.uid()));

CREATE POLICY "alert_urls: insercion"
  ON public.alert_urls FOR INSERT
  WITH CHECK (alert_id IN (SELECT id FROM public.alerts WHERE user_id = auth.uid()));

CREATE POLICY "alert_urls: edicion"
  ON public.alert_urls FOR UPDATE
  USING (alert_id IN (SELECT id FROM public.alerts WHERE user_id = auth.uid()));

CREATE POLICY "alert_urls: borrado"
  ON public.alert_urls FOR DELETE
  USING (alert_id IN (SELECT id FROM public.alerts WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_alert_urls_alert_id ON public.alert_urls(alert_id);
