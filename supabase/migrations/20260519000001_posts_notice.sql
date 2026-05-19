-- 공지글 플래그 (디시 스타일 게시판)
alter table public.posts
  add column if not exists is_notice boolean not null default false;

create index if not exists posts_notice_created_idx
  on public.posts (is_notice desc, created_at desc);
