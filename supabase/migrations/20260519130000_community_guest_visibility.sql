-- 비회원 글·댓글·추천 + 글 공개 범위 (전체공개 / 비공개 / 회원공개)

-- 1. posts: visibility, nullable author (비회원 글)
alter table public.posts
  add column if not exists visibility text not null default 'public';

alter table public.posts
  drop constraint if exists posts_visibility_check;

alter table public.posts
  add constraint posts_visibility_check
  check (visibility in ('public', 'private', 'members'));

alter table public.posts
  alter column author_id drop not null;

create index if not exists posts_visibility_idx on public.posts (visibility);

-- 2. 글 작성자 메타: 비회원(author_id null)은 display_name 그대로 사용
create or replace function public.set_posts_author_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dn text;
begin
  if new.author_id is null then
    new.author_display_name := coalesce(nullif(trim(new.author_display_name), ''), '익명');
    return new;
  end if;

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

-- 3. 읽기 권한 헬퍼
create or replace function public.community_can_read_post(
  p_hidden boolean,
  p_visibility text,
  p_author_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_hidden then
      auth.uid() is not null
      and (
        p_author_id = auth.uid()
        or exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid() and pr.role = 'admin'
        )
      )
    when p_visibility = 'public' then true
    when p_visibility = 'members' then auth.uid() is not null
    when p_visibility = 'private' then
      auth.uid() is not null
      and (
        p_author_id = auth.uid()
        or exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid() and pr.role = 'admin'
        )
      )
    else false
  end;
$$;

-- 4. posts RLS 재정의
drop policy if exists "posts_select_public" on public.posts;
drop policy if exists "posts_select_authenticated" on public.posts;
drop policy if exists "posts_insert_own" on public.posts;

create policy "posts_select_visible"
  on public.posts for select
  using (
    public.community_can_read_post(hidden, visibility, author_id)
  );

create policy "posts_insert_authenticated"
  on public.posts for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and visibility in ('public', 'private', 'members')
  );

create policy "posts_insert_anon"
  on public.posts for insert
  to anon
  with check (
    author_id is null
    and length(trim(author_display_name)) >= 1
    and visibility = 'public'
    and hidden = false
  );

-- 5. comments: 비회원 댓글
drop policy if exists "comments_insert_authenticated" on public.comments;

create policy "comments_insert_authenticated"
  on public.comments for insert
  to authenticated
  with check (
    (
      author_id = auth.uid()
      or (
        author_id is null
        and length(trim(author_display_name)) >= 1
      )
    )
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and public.community_can_read_post(p.hidden, p.visibility, p.author_id)
    )
  );

create policy "comments_insert_anon"
  on public.comments for insert
  to anon
  with check (
    author_id is null
    and length(trim(author_display_name)) >= 1
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and public.community_can_read_post(p.hidden, p.visibility, p.author_id)
    )
  );

-- 6. likes / dislikes: 비회원 voter_key
alter table public.likes
  add column if not exists voter_key text;

alter table public.likes
  alter column user_id drop not null;

alter table public.likes
  drop constraint if exists likes_user_or_key;

alter table public.likes
  add constraint likes_user_or_key
  check (user_id is not null or voter_key is not null);

alter table public.likes
  drop constraint if exists likes_post_id_user_id_key;

create unique index if not exists likes_post_user_unique
  on public.likes (post_id, user_id)
  where user_id is not null;

create unique index if not exists likes_post_voter_key_unique
  on public.likes (post_id, voter_key)
  where voter_key is not null;

drop policy if exists "likes_insert_own" on public.likes;
drop policy if exists "likes_delete_own" on public.likes;

create policy "likes_insert_own"
  on public.likes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "likes_insert_anon"
  on public.likes for insert
  to anon
  with check (user_id is null and voter_key is not null and length(trim(voter_key)) >= 8);

create policy "likes_delete_own"
  on public.likes for delete
  to authenticated
  using (user_id = auth.uid());

create policy "likes_delete_anon"
  on public.likes for delete
  to anon
  using (user_id is null and voter_key is not null);

alter table public.dislikes
  add column if not exists voter_key text;

alter table public.dislikes
  alter column user_id drop not null;

alter table public.dislikes
  drop constraint if exists dislikes_user_or_key;

alter table public.dislikes
  add constraint dislikes_user_or_key
  check (user_id is not null or voter_key is not null);

alter table public.dislikes
  drop constraint if exists dislikes_post_id_user_id_key;

create unique index if not exists dislikes_post_user_unique
  on public.dislikes (post_id, user_id)
  where user_id is not null;

create unique index if not exists dislikes_post_voter_key_unique
  on public.dislikes (post_id, voter_key)
  where voter_key is not null;

drop policy if exists "dislikes_insert_own" on public.dislikes;
drop policy if exists "dislikes_delete_own" on public.dislikes;

create policy "dislikes_insert_own"
  on public.dislikes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "dislikes_insert_anon"
  on public.dislikes for insert
  to anon
  with check (user_id is null and voter_key is not null and length(trim(voter_key)) >= 8);

create policy "dislikes_delete_own"
  on public.dislikes for delete
  to authenticated
  using (user_id = auth.uid());

create policy "dislikes_delete_anon"
  on public.dislikes for delete
  to anon
  using (user_id is null and voter_key is not null);

-- 7. poll votes: 비회원 voter_key
alter table public.post_poll_votes
  add column if not exists voter_key text;

alter table public.post_poll_votes
  alter column user_id drop not null;

alter table public.post_poll_votes
  drop constraint if exists post_poll_votes_unique_option;

alter table public.post_poll_votes
  drop constraint if exists post_poll_votes_user_or_key;

alter table public.post_poll_votes
  add constraint post_poll_votes_user_or_key
  check (user_id is not null or voter_key is not null);

create unique index if not exists post_poll_votes_user_option
  on public.post_poll_votes (post_id, poll_id, user_id, option_id)
  where user_id is not null;

create unique index if not exists post_poll_votes_guest_option
  on public.post_poll_votes (post_id, poll_id, voter_key, option_id)
  where voter_key is not null;

drop policy if exists "post_poll_votes_insert_own" on public.post_poll_votes;
drop policy if exists "post_poll_votes_update_own" on public.post_poll_votes;
drop policy if exists "post_poll_votes_delete_own" on public.post_poll_votes;

create policy "post_poll_votes_insert_authenticated"
  on public.post_poll_votes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "post_poll_votes_insert_anon"
  on public.post_poll_votes for insert
  to anon
  with check (user_id is null and voter_key is not null and length(trim(voter_key)) >= 8);

create policy "post_poll_votes_update_authenticated"
  on public.post_poll_votes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "post_poll_votes_delete_authenticated"
  on public.post_poll_votes for delete
  to authenticated
  using (user_id = auth.uid());

create policy "post_poll_votes_delete_anon"
  on public.post_poll_votes for delete
  to anon
  using (user_id is null and voter_key is not null);

-- 8. 비회원 미디어 업로드 (guest/ 경로)
drop policy if exists "community_media_insert_authenticated" on storage.objects;

create policy "community_media_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'community-media');

create policy "community_media_insert_anon"
  on storage.objects for insert
  to anon
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = 'guest'
  );
