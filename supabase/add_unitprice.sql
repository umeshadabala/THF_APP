-- Run once in Supabase Dashboard → SQL Editor
alter table public.inventory add column if not exists unitprice numeric default 0;
