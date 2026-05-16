-- 가구(공유코드) 단위 달력 메모·일정 JSON (장부 household_ledgers 와 동일한 id = household_id::text 패턴)

create table if not exists public.household_calendar_memos (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.household_calendar_memos enable row level security;

create policy "household_calendar_memos_select_member"
  on public.household_calendar_memos for select
  to authenticated
  using (id = public.my_household_id()::text);

create policy "household_calendar_memos_insert_member"
  on public.household_calendar_memos for insert
  to authenticated
  with check (id = public.my_household_id()::text);

create policy "household_calendar_memos_update_member"
  on public.household_calendar_memos for update
  to authenticated
  using (id = public.my_household_id()::text)
  with check (id = public.my_household_id()::text);
