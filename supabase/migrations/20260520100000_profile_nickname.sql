-- 익명 활동: profiles.nickname (실명·이메일 접두사는 UI에 쓰지 않음)

alter table public.profiles
  add column if not exists nickname text;

comment on column public.profiles.nickname is '커뮤니티·헤더에 표시하는 익명 닉네임';

-- 신규 가입 시 실명 자동 입력 금지
create or replace function public.handle_community_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, nickname, avatar_url)
  values (
    new.id,
    null,
    null,
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  );
  return new;
end;
$$;

-- 글 작성 시 프로필 닉네임 우선 (실명·이메일 접두사 미사용)
create or replace function public.set_posts_author_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dn text;
begin
  select coalesce(nullif(trim(nickname), ''), '') into dn
  from public.profiles
  where id = new.author_id;

  new.author_display_name := coalesce(
    nullif(trim(new.author_display_name), ''),
    nullif(dn, ''),
    '익명'
  );
  return new;
end;
$$;
