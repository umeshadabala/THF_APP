-- The Homely Food (THF) — Supabase schema
-- Run in Supabase SQL Editor for a fresh project.

create table if not exists public.orders (
  id text primary key,
  customer text,
  itemid integer,
  itemname text not null,
  price integer not null,
  status text not null default 'Pending',
  date timestamptz not null default now()
);

create table if not exists public.inventory (
  id text primary key,
  name text not null,
  quantity numeric not null default 0,
  unit text not null default 'kg',
  unitprice numeric default 0
);

-- If inventory already exists without unitprice:
alter table public.inventory add column if not exists unitprice numeric default 0;

create table if not exists public.spending (
  id text primary key,
  amount numeric not null,
  category text not null,
  note text,
  date timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.inventory enable row level security;
alter table public.spending enable row level security;

-- Allow anon access (matches current app: client-side admin password gate)
create policy "anon_all_orders" on public.orders for all to anon using (true) with check (true);
create policy "anon_all_inventory" on public.inventory for all to anon using (true) with check (true);
create policy "anon_all_spending" on public.spending for all to anon using (true) with check (true);

grant all on public.orders to anon, authenticated;
grant all on public.inventory to anon, authenticated;
grant all on public.spending to anon, authenticated;
