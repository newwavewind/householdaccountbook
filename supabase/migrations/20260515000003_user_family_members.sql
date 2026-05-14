-- 사용자별 가족 구성원 이름 저장 테이블 (크로스 디바이스 동기화용)
create table if not exists public.user_family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  members text[] not null default '{}',
  updated_at timestamptz default now()
);

alter table public.user_family_members enable row level security;

create policy "user can read own members"
  on public.user_family_members for select
  using (user_id = auth.uid());

create policy "user can upsert own members"
  on public.user_family_members for insert
  with check (user_id = auth.uid());

create policy "user can update own members"
  on public.user_family_members for update
  using (user_id = auth.uid());

create or replace function public.upsert_user_family_members(p_members text[])
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_family_members (user_id, members, updated_at)
    values (auth.uid(), p_members, now())
    on conflict (user_id)
    do update set members = p_members, updated_at = now();
end;
$$;

-- households 테이블에 members 컬럼 추가 (가족 구성원 공유용)
alter table public.households
  add column if not exists members text[] not null default '{}';

create or replace function public.set_household_members(p_household_id uuid, p_members text[])
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this household';
  end if;
  update public.households set members = p_members where id = p_household_id;
end;
$$;
