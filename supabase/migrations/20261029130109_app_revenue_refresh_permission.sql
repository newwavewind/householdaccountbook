alter table public.app_revenue_viewers add column can_refresh boolean not null default false;
comment on column public.app_revenue_viewers.can_refresh is 'May collect signed store reports; does not grant direct snapshot or settings writes.';
