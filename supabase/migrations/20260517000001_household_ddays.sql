-- 가구 단위 디데이 목록 JSON (household_calendar_memos 와 동일 id 패턴)

create table if not exists public.household_ddays (
  id text primary key,
  payload jsonb not null default '{"events":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.household_ddays enable row level security;

create policy "household_ddays_select_member"
  on public.household_ddays for select
  to authenticated
  using (id = public.my_household_id()::text);

create policy "household_ddays_insert_member"
  on public.household_ddays for insert
  to authenticated
  with check (id = public.my_household_id()::text);

create policy "household_ddays_update_member"
  on public.household_ddays for update
  to authenticated
  using (id = public.my_household_id()::text)
  with check (id = public.my_household_id()::text);
