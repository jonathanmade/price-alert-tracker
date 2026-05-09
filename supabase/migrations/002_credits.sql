-- =============================================================
-- PriceAlert — Sistema de créditos
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =============================================================

-- Añadir columna de créditos al perfil
alter table public.profiles
  add column if not exists credits integer not null default 10;

-- Actualizar el trigger para dar 10 créditos a nuevos usuarios
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, credits)
  values (new.id, new.email, 10);
  return new;
end;
$$;

-- Tabla de transacciones de créditos (para auditoría y billing)
create table if not exists public.credit_transactions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  amount      integer not null,  -- negativo = consumo, positivo = recarga
  reason      text not null,     -- 'price_check', 'purchase', 'signup_bonus'
  created_at  timestamptz default now()
);

alter table public.credit_transactions enable row level security;

create policy "Transacciones propias: lectura"
  on public.credit_transactions for select
  using (auth.uid() = user_id);

create index if not exists idx_credit_transactions_user
  on public.credit_transactions (user_id, created_at desc);
