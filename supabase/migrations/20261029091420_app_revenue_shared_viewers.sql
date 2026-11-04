-- Explicit, read-only sharing. Grants are administered server-side only.
create table public.app_revenue_viewers (
  viewer_id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (viewer_id <> owner_id)
);
create index app_revenue_viewers_owner_idx on public.app_revenue_viewers(owner_id);
alter table public.app_revenue_viewers enable row level security;
revoke all on public.app_revenue_viewers from public, anon, authenticated;
grant select on public.app_revenue_viewers to authenticated;
grant all on public.app_revenue_viewers to service_role;
create policy app_revenue_viewers_select_linked on public.app_revenue_viewers
for select to authenticated using (
  (viewer_id = (select auth.uid()) or owner_id = (select auth.uid()))
  and exists (select 1 from public.household_members m
    where m.household_id = app_revenue_viewers.household_id and m.user_id = app_revenue_viewers.viewer_id)
  and exists (select 1 from public.household_members m
    where m.household_id = app_revenue_viewers.household_id and m.user_id = app_revenue_viewers.owner_id)
);
create policy app_revenue_snapshots_select_shared on public.app_revenue_snapshots
for select to authenticated using (
  exists (select 1 from public.app_revenue_viewers v
    where v.owner_id = app_revenue_snapshots.user_id and v.viewer_id = (select auth.uid()))
);
-- No shared INSERT, UPDATE or DELETE policy: only the original owner may write.
