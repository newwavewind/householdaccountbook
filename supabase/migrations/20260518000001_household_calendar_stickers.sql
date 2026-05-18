-- 스티커 메모 보드 (가구 단위 JSON 배열). household_calendar_memos / household_ddays 와 동일 패턴.
-- 앱·SQL 별칭: calendar_stickers (view)

create table if not exists public.household_calendar_stickers (
  id text primary key,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.household_calendar_stickers enable row level security;

create policy "household_calendar_stickers_select_member"
  on public.household_calendar_stickers for select
  to authenticated
  using (id = public.my_household_id()::text);

create policy "household_calendar_stickers_insert_member"
  on public.household_calendar_stickers for insert
  to authenticated
  with check (id = public.my_household_id()::text);

create policy "household_calendar_stickers_update_member"
  on public.household_calendar_stickers for update
  to authenticated
  using (id = public.my_household_id()::text)
  with check (id = public.my_household_id()::text);

-- 대시보드·SQL 탐색용 별칭 (읽기 전용)
create or replace view public.calendar_memos as
  select id as household_id, payload, updated_at
  from public.household_calendar_memos;

create or replace view public.calendar_ddays as
  select id as household_id, payload, updated_at
  from public.household_ddays;

create or replace view public.calendar_stickers as
  select id as household_id, payload, updated_at
  from public.household_calendar_stickers;
