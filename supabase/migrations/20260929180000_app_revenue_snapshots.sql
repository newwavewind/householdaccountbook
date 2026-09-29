-- App revenue workspace snapshot (phone/PC share per signed-in user)
create table if not exists public.app_revenue_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_revenue_snapshots enable row level security;

drop policy if exists "app_revenue_snapshots_select_own" on public.app_revenue_snapshots;
drop policy if exists "app_revenue_snapshots_insert_own" on public.app_revenue_snapshots;
drop policy if exists "app_revenue_snapshots_update_own" on public.app_revenue_snapshots;
drop policy if exists "app_revenue_snapshots_delete_own" on public.app_revenue_snapshots;

create policy "app_revenue_snapshots_select_own"
  on public.app_revenue_snapshots for select
  using (auth.uid() = user_id);

create policy "app_revenue_snapshots_insert_own"
  on public.app_revenue_snapshots for insert
  with check (auth.uid() = user_id);

create policy "app_revenue_snapshots_update_own"
  on public.app_revenue_snapshots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "app_revenue_snapshots_delete_own"
  on public.app_revenue_snapshots for delete
  using (auth.uid() = user_id);
