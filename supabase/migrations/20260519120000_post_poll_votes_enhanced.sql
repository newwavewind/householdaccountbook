-- 투표: 복수 선택, 참여자 표시명, 삭제(복수 선택 해제)

alter table public.post_poll_votes
  add column if not exists voter_display_name text;

alter table public.post_poll_votes
  drop constraint if exists post_poll_votes_post_id_poll_id_user_id_key;

alter table public.post_poll_votes
  drop constraint if exists post_poll_votes_unique_vote;

alter table public.post_poll_votes
  add constraint post_poll_votes_unique_option
  unique (post_id, poll_id, user_id, option_id);

create policy "post_poll_votes_delete_own"
  on public.post_poll_votes for delete
  to authenticated
  using (user_id = auth.uid());
