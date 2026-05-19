-- 커뮤니티 회원 등급 (공지 작성 권한)

alter table public.profiles
  add column if not exists community_grade int not null default 0;

alter table public.profiles
  drop constraint if exists profiles_community_grade_check;

alter table public.profiles
  add constraint profiles_community_grade_check
  check (community_grade >= 0 and community_grade <= 10);

create index if not exists profiles_community_grade_idx on public.profiles (community_grade);

-- 공지 작성 가능: admin 또는 community_grade >= 2
create or replace function public.community_can_write_notice(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and (p.role = 'admin' or p.community_grade >= 2)
  );
$$;

create or replace function public.enforce_post_notice_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(NEW.is_notice, false) = false then
    return NEW;
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    return NEW;
  end if;

  if NEW.author_id is null then
    raise exception 'notice_requires_login';
  end if;

  if not public.community_can_write_notice(NEW.author_id) then
    raise exception 'insufficient_grade_for_notice';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_posts_notice_permission on public.posts;

create trigger trg_posts_notice_permission
  before insert or update of is_notice, author_id on public.posts
  for each row execute function public.enforce_post_notice_permission();

-- profiles: 본인 등급 조회, admin은 전체 등급 수정
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and community_grade = (select community_grade from public.profiles where id = auth.uid())
  );

create policy "profiles_update_grade_admin"
  on public.profiles for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
