-- =============================================================
-- PriceRadar — Auditoría de seguridad: RLS y función atómica
-- =============================================================
-- Este archivo documenta el estado de seguridad completo y añade
-- mejoras: función atómica para créditos (evita race condition).
-- =============================================================


-- -------------------------------------------------------------
-- 1. VERIFICACIÓN — tablas protegidas contra escritura de clientes
-- -------------------------------------------------------------
-- price_history y credit_transactions solo son escritas por el
-- backend (SERVICE ROLE KEY). Con RLS activo y sin políticas de
-- INSERT/UPDATE/DELETE, los clientes autenticados NO pueden escribir.
-- Verificar que RLS está activo (ya aplicado en migraciones anteriores):

alter table public.price_history        enable row level security;
alter table public.credit_transactions  enable row level security;


-- -------------------------------------------------------------
-- 2. POLÍTICAS EXPLÍCITAS DE SOLO LECTURA
-- -------------------------------------------------------------
-- Aseguramos que no existan políticas de escritura no intencionadas.
-- Las tablas ya tienen RLS activo; aquí documentamos que la política
-- de lectura existente es la única prevista.

-- price_history — ya cubierta en 001_tables_and_rls.sql
-- credit_transactions — ya cubierta en 002_credits.sql


-- -------------------------------------------------------------
-- 3. FUNCIÓN ATÓMICA deduct_credit
-- -------------------------------------------------------------
-- Reemplaza el patrón READ→UPDATE no atómico en el worker de Celery.
-- Hace UPDATE condicional en una sola operación: si credits > 0,
-- descuenta 1 y devuelve los créditos restantes. Si credits = 0,
-- no modifica nada y devuelve NULL → el worker sabe que debe abortar.
--
-- Uso desde Python (supabase-py):
--   result = supabase.rpc("deduct_credit", {"p_user_id": user_id}).execute()
--   remaining = result.data  # None si sin créditos, int si OK

create or replace function public.deduct_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  update profiles
  set credits = credits - 1
  where id = p_user_id
    and credits > 0
  returning credits into v_remaining;

  return v_remaining;  -- NULL si no se actualizó (sin créditos)
end;
$$;

-- Solo el backend (service role) puede llamar a esta función
revoke execute on function public.deduct_credit(uuid) from public, anon, authenticated;
grant  execute on function public.deduct_credit(uuid) to service_role;


-- -------------------------------------------------------------
-- 4. ÍNDICES DE SEGURIDAD / RENDIMIENTO ADICIONALES
-- -------------------------------------------------------------

create index if not exists idx_products_scrape_status
  on public.products (last_scrape_status)
  where last_scrape_status = 'error';

create index if not exists idx_alerts_check_time
  on public.alerts (check_time)
  where status = 'active';
