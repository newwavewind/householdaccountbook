-- Community interactions: comments, likes, and media storage.

-- 1. comments table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_display_name text not null default '익명',
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create index comments_post_id_idx on public.comments (post_id, created_at asc);

-- 2. likes table
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.likes enable row level security;

create index likes_post_id_idx on public.likes (post_id);

-- 3. add like_count + comment_count to posts (denormalized for performance)
alter table public.posts
  add column if not exists like_count int not null default 0,
  add column if not exists comment_count int not null default 0;

-- 4. triggers to keep counts in sync
create or replace function public.update_post_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = OLD.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_like_count on public.likes;
create trigger trg_like_count
  after insert or delete on public.likes
  for each row execute function public.update_post_like_count();

create or replace function public.update_post_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = OLD.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_comment_count on public.comments;
create trigger trg_comment_count
  after insert or delete on public.comments
  for each row execute function public.update_post_comment_count();

-- 5. RLS: comments — anyone can read, authenticated can write own
create policy "comments_select_public"
  on public.comments for select
  to anon using (true);

create policy "comments_select_authenticated"
  on public.comments for select
  to authenticated using (true);

create policy "comments_insert_authenticated"
  on public.comments for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "comments_delete_own_or_admin"
  on public.comments for delete
  to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 6. RLS: likes — authenticated only
create policy "likes_select_all"
  on public.likes for select
  to anon using (true);

create policy "likes_select_authenticated"
  on public.likes for select
  to authenticated using (true);

create policy "likes_insert_own"
  on public.likes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "likes_delete_own"
  on public.likes for delete
  to authenticated
  using (user_id = auth.uid());

-- 7. Storage bucket for community media
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  true,
  52428800, -- 50MB
  array['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do nothing;

-- Storage RLS
create policy "community_media_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'community-media');

create policy "community_media_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'community-media');

create policy "community_media_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'community-media' and owner = auth.uid()::text);
