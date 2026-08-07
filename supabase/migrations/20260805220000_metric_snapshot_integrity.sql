-- BeFluencer Reports — metric snapshot integrity
--
-- Prevents duplicate timestamps per video/campaign for manual and future sync entry.
-- Append-only semantics remain; deletes are explicit user actions only.

create unique index if not exists video_metric_snapshots_video_id_captured_at_uidx
  on public.video_metric_snapshots (video_id, captured_at);

create unique index if not exists sound_metric_snapshots_campaign_id_captured_at_uidx
  on public.sound_metric_snapshots (campaign_id, captured_at);
