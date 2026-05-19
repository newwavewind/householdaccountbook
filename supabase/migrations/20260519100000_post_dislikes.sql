-- 비추천 (디시 스타일 추천/비추천)

create table if not exists public.dislikes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.dislikes enable row level security;

create index if not exists dislikes_post_id_idx on public.dislikes (post_id);

alter table public.posts
  add column if not exists dislike_count int not null default 0;

create or replace function public.update_post_dislike_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set dislike_count = dislike_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set dislike_count = greatest(dislike_count - 1, 0) where id = OLD.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_dislike_count on public.dislikes;
create trigger trg_dislike_count
  after insert or delete on public.dislikes
  for each row execute function public.update_post_dislike_count();

create policy "dislikes_select_all"
  on public.dislikes for select
  to anon using (true);

create policy "dislikes_select_authenticated"
  on public.dislikes for select
  to authenticated using (true);

create policy "dislikes_insert_own"
  on public.dislikes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "dislikes_delete_own"
  on public.dislikes for delete
  to authenticated
  using (user_id = auth.uid());
