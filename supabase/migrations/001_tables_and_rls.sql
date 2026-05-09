-- =============================================================
-- PriceAlert — Tablas principales + RLS
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =============================================================


-- -------------------------------------------------------------
-- 1. TABLAS
-- -------------------------------------------------------------

-- Perfil de usuario (se crea automáticamente al registrarse)
create table if not exists public.profiles (
  id         uuid references auth.users on delete cascade primary key,
  email      text unique not null,
  created_at timestamptz default now()
);

-- Productos monitorizados
create table if not exists public.products (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users on delete cascade not null,
  name             text not null,
  url              text not null,
  current_price    numeric(10,2),
  last_checked_at  timestamptz,
  created_at       timestamptz default now()
);

-- Alertas de precio
create table if not exists public.alerts (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users on delete cascade not null,
  product_id   uuid references public.products on delete cascade not null,
  target_price numeric(10,2) not null,
  status       text not null default 'active'
                 check (status in ('active', 'triggered', 'paused')),
  triggered_at timestamptz,
  created_at   timestamptz default now(),
  -- Un usuario no puede tener dos alertas activas para el mismo producto
  unique nulls not distinct (user_id, product_id, status)
);

-- Historial de precios
create table if not exists public.price_history (
  id         uuid default gen_random_uuid() primary key,
  product_id uuid references public.products on delete cascade not null,
  price      numeric(10,2) not null,
  checked_at timestamptz default now()
);


-- -------------------------------------------------------------
-- 2. TRIGGER — crear perfil al registrar usuario
-- -------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- -------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- -------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.products     enable row level security;
alter table public.alerts       enable row level security;
alter table public.price_history enable row level security;


-- profiles
create policy "Perfil propio: lectura"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Perfil propio: edicion"
  on public.profiles for update
  using (auth.uid() = id);


-- products
create policy "Productos propios: lectura"
  on public.products for select
  using (auth.uid() = user_id);

create policy "Productos propios: insercion"
  on public.products for insert
  with check (auth.uid() = user_id);

create policy "Productos propios: edicion"
  on public.products for update
  using (auth.uid() = user_id);

create policy "Productos propios: borrado"
  on public.products for delete
  using (auth.uid() = user_id);


-- alerts
create policy "Alertas propias: lectura"
  on public.alerts for select
  using (auth.uid() = user_id);

create policy "Alertas propias: insercion"
  on public.alerts for insert
  with check (auth.uid() = user_id);

create policy "Alertas propias: edicion"
  on public.alerts for update
  using (auth.uid() = user_id);

create policy "Alertas propias: borrado"
  on public.alerts for delete
  using (auth.uid() = user_id);


-- price_history — solo lectura para usuarios (escritura solo desde el worker con service role)
create policy "Historial: lectura de productos propios"
  on public.price_history for select
  using (
    exists (
      select 1 from public.products
      where products.id = price_history.product_id
        and products.user_id = auth.uid()
    )
  );


-- -------------------------------------------------------------
-- 4. ÍNDICES
-- -------------------------------------------------------------

create index if not exists idx_products_user_id   on public.products (user_id);
create index if not exists idx_alerts_user_id     on public.alerts (user_id);
create index if not exists idx_alerts_product_id  on public.alerts (product_id);
create index if not exists idx_alerts_status      on public.alerts (status);
create index if not exists idx_price_history_product on public.price_history (product_id, checked_at desc);
