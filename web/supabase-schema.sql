-- Supabase SQL Editor에서 한 번 실행하세요.
-- 이후 Table Editor → household_ledgers → Realtime 켜기(또는 아래 주석 참고)

create table if not exists public.household_ledgers (
  id text primary key,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.household_ledgers enable row level security;

-- 로그인 없이 둘이 같은 URL로 쓰는 최소 설정(익명으로 읽기/쓰기 가능).
-- URL이 퍼지면 누구나 이 테이블의 모든 행에 접근할 수 있으니, VITE_LEDGER_ID는 추측하기 어려운 문자열로 두는 것을 권장합니다.
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

-- Realtime: Dashboard → Database → Replication → household_ledgers 활성화
-- 또는 (프로젝트에 따라) publication에 테이블 추가
