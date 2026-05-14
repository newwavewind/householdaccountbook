-- Shared ledger JSON blob (anonymous access for household sync). Keeps parity with web/supabase-schema.sql.

create table if not exists public.household_ledgers (
  id text primary key,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.household_ledgers enable row level security;

drop policy if exists "household_ledgers_select_anon" on public.household_ledgers;
drop policy if exists "household_ledgers_insert_anon" on public.household_ledgers;
drop policy if exists "household_ledgers_update_anon" on public.household_ledgers;

create policy "household_ledgers_select_anon"
  on public.household_ledgers for select
  to anon
  using (true);

create policy "household_ledgers_insert_anon"
  on public.household_ledgers for insert
  to anon
  with check (true);

create policy "household_ledgers_update_anon"
  on public.household_ledgers for update
  to anon
  using (true)
  with check (true);
