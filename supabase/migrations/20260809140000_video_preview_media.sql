-- BeFluencer Reports — optional manually uploaded featured video preview (MP4/WebM)
--
-- Stores a public Storage URL for an admin-uploaded preview asset.
-- Does not change video_url (TikTok page) or thumbnail_url (poster) semantics.
-- Local migration only — do not apply remotely from this agent session.

alter table public.videos
  add column if not exists preview_media_url text;

alter table public.videos
  add column if not exists preview_media_type text;

comment on column public.videos.preview_media_url is
  'Public Storage URL for an optional manually uploaded MP4/WebM preview. Null when absent.';

comment on column public.videos.preview_media_type is
  'MIME type of preview_media_url (video/mp4 or video/webm). Null when absent.';

-- Public-read bucket; uploads restricted to authenticated clients via Storage RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'featured-video-previews',
  'featured-video-previews',
  true,
  31457280,
  array['video/mp4', 'video/webm']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists featured_video_previews_public_select on storage.objects;
drop policy if exists featured_video_previews_authenticated_insert on storage.objects;
drop policy if exists featured_video_previews_authenticated_update on storage.objects;
drop policy if exists featured_video_previews_authenticated_delete on storage.objects;

create policy featured_video_previews_public_select
  on storage.objects
  for select
  to public
  using (bucket_id = 'featured-video-previews');

create policy featured_video_previews_authenticated_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'featured-video-previews');

create policy featured_video_previews_authenticated_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'featured-video-previews')
  with check (bucket_id = 'featured-video-previews');

create policy featured_video_previews_authenticated_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'featured-video-previews');
