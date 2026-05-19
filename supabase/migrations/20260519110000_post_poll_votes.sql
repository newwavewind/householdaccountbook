-- 게시글 내 투표 참여 기록

create table if not exists public.post_poll_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  poll_id text not null,
  option_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, poll_id, user_id)
);

alter table public.post_poll_votes enable row level security;

create index if not exists post_poll_votes_post_poll_idx
  on public.post_poll_votes (post_id, poll_id);

create policy "post_poll_votes_select_all"
  on public.post_poll_votes for select
  to anon using (true);

create policy "post_poll_votes_select_authenticated"
  on public.post_poll_votes for select
  to authenticated using (true);

create policy "post_poll_votes_insert_own"
  on public.post_poll_votes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "post_poll_votes_update_own"
  on public.post_poll_votes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
