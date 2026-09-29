-- App revenue cloud sync jobs (user-scoped via JWT, no service role required)
create table if not exists public.app_revenue_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  state text not null check (state in ('running', 'done')),
  progress text not null default '',
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_revenue_jobs_user_created_idx
  on public.app_revenue_jobs (user_id, created_at desc);

alter table public.app_revenue_jobs enable row level security;

drop policy if exists "app_revenue_jobs_select_own" on public.app_revenue_jobs;
drop policy if exists "app_revenue_jobs_insert_own" on public.app_revenue_jobs;
drop policy if exists "app_revenue_jobs_update_own" on public.app_revenue_jobs;
drop policy if exists "app_revenue_jobs_delete_own" on public.app_revenue_jobs;

create policy "app_revenue_jobs_select_own"
  on public.app_revenue_jobs for select
  using (auth.uid() = user_id);

create policy "app_revenue_jobs_insert_own"
  on public.app_revenue_jobs for insert
  with check (auth.uid() = user_id);

create policy "app_revenue_jobs_update_own"
  on public.app_revenue_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "app_revenue_jobs_delete_own"
  on public.app_revenue_jobs for delete
  using (auth.uid() = user_id);
