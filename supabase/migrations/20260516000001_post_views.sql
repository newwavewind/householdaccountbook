-- Post view tracking: total view_count on posts + daily breakdown table

-- 1. Add view_count column to posts
alter table public.posts
  add column if not exists view_count int not null default 0;

-- 2. Daily view tracking table
create table if not exists public.post_daily_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  view_date date not null default current_date,
  view_count int not null default 0,
  primary key (post_id, view_date)
);

alter table public.post_daily_views enable row level security;

create policy "post_daily_views_select"
  on public.post_daily_views for select
  using (true);

-- 3. RPC: record a single view (increments both total and daily counts)
create or replace function public.record_post_view(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
    set view_count = view_count + 1
    where id = p_post_id;

  insert into public.post_daily_views (post_id, view_date, view_count)
  values (p_post_id, current_date, 1)
  on conflict (post_id, view_date)
  do update set view_count = post_daily_views.view_count + 1;
end;
$$;
