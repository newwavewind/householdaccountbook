-- Community: profiles (linked to auth.users), posts with RLS.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_display_name text not null default '',
  title text not null,
  body text not null default '',
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create index posts_created_at_desc on public.posts (created_at desc);
create index posts_author_id_idx on public.posts (author_id);

-- New auth user → profile row
create or replace function public.handle_community_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_community on auth.users;

create trigger on_auth_user_created_community
  after insert on auth.users
  for each row execute function public.handle_community_new_user();

create or replace function public.set_posts_author_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dn text;
begin
  select coalesce(nullif(trim(display_name), ''), '') into dn
  from public.profiles
  where id = new.author_id;
  if dn is null or dn = '' then
    select coalesce(nullif(trim(email), ''), 'user') into dn
    from auth.users
    where id = new.author_id;
  end if;
  new.author_display_name := coalesce(nullif(trim(new.author_display_name), ''), dn, '작성자');
  return new;
end;
$$;

drop trigger if exists trg_posts_author_meta on public.posts;

create trigger trg_posts_author_meta
  before insert on public.posts
  for each row execute function public.set_posts_author_meta();

create or replace function public.touch_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_posts_updated_at on public.posts;

create trigger trg_posts_updated_at
  before update on public.posts
  for each row execute function public.touch_posts_updated_at();

-- RLS: profiles
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- RLS: posts — public read of non-hidden; full read for author or admin
create policy "posts_select_public"
  on public.posts for select
  to anon
  using (hidden = false);

create policy "posts_select_authenticated"
  on public.posts for select
  to authenticated
  using (
    hidden = false
    or author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "posts_insert_own"
  on public.posts for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "posts_update_author_or_admin"
  on public.posts for update
  to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "posts_delete_author_or_admin"
  on public.posts for delete
  to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Realtime (optional): enable replication for posts in Dashboard or via SQL publication if needed
