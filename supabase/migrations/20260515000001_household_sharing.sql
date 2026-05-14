-- Household sharing: families share a single ledger via a 6-char code.

-- 1. households table
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.households enable row level security;

-- 2. household_members table
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table public.household_members enable row level security;

-- 3. helper function: get household_id for current user
create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid()
  limit 1;
$$;

-- 4. RLS: households
create policy "households_select_member"
  on public.households for select
  to authenticated
  using (id = public.my_household_id());

create policy "households_insert_owner"
  on public.households for insert
  to authenticated
  with check (owner_id = auth.uid());

-- 5. RLS: household_members
create policy "household_members_select_member"
  on public.household_members for select
  to authenticated
  using (household_id = public.my_household_id() or user_id = auth.uid());

create policy "household_members_insert"
  on public.household_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "household_members_delete_own"
  on public.household_members for delete
  to authenticated
  using (user_id = auth.uid());

-- 6. Replace household_ledgers RLS: only household members can access
drop policy if exists "household_ledgers_select_anon" on public.household_ledgers;
drop policy if exists "household_ledgers_insert_anon" on public.household_ledgers;
drop policy if exists "household_ledgers_update_anon" on public.household_ledgers;

create policy "household_ledgers_select_member"
  on public.household_ledgers for select
  to authenticated
  using (id = public.my_household_id()::text);

create policy "household_ledgers_insert_member"
  on public.household_ledgers for insert
  to authenticated
  with check (id = public.my_household_id()::text);

create policy "household_ledgers_update_member"
  on public.household_ledgers for update
  to authenticated
  using (id = public.my_household_id()::text)
  with check (id = public.my_household_id()::text);

-- 7. Function to create a household + add owner as member (atomic)
create or replace function public.create_household_with_member()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  new_code text;
  attempt int := 0;
begin
  -- generate unique 6-char alphanumeric code
  loop
    new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.households where code = new_code);
    attempt := attempt + 1;
    if attempt > 10 then raise exception 'code generation failed'; end if;
  end loop;

  insert into public.households (code, owner_id)
  values (new_code, auth.uid())
  returning id into new_id;

  insert into public.household_members (household_id, user_id)
  values (new_id, auth.uid());

  return json_build_object('id', new_id, 'code', new_code);
end;
$$;

-- 8. Function to join household by code
create or replace function public.join_household_by_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  -- already a member?
  if public.my_household_id() is not null then
    raise exception 'already_member';
  end if;

  select id into hid from public.households where upper(code) = upper(p_code);
  if hid is null then
    raise exception 'code_not_found';
  end if;

  insert into public.household_members (household_id, user_id)
  values (hid, auth.uid())
  on conflict do nothing;

  return json_build_object('household_id', hid);
end;
$$;
