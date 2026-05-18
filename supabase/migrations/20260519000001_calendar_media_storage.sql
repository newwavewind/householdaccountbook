-- 달력·스티커 메모 사진 (HTML에는 URL만 저장)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'calendar-media',
  'calendar-media',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "calendar_media_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'calendar-media');

create policy "calendar_media_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'calendar-media');

create policy "calendar_media_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'calendar-media' and owner = auth.uid());
