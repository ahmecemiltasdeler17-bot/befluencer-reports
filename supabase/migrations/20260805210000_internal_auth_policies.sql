-- BeFluencer Reports — internal authenticated access policies
--
-- Security model:
-- - Public signup is disabled in Supabase Auth.
-- - Users are created manually from the Supabase Dashboard.
-- - Only authenticated (signed-in) users may read or write application data.
-- - Anonymous (anon) role has no table privileges.
-- - Future public report sharing will use a separate, narrowly scoped mechanism.

-- ---------------------------------------------------------------------------
-- Revoke anonymous access and grant authenticated role privileges
-- ---------------------------------------------------------------------------

revoke all on public.campaigns from anon;
revoke all on public.creators from anon;
revoke all on public.campaign_creators from anon;
revoke all on public.videos from anon;
revoke all on public.video_metric_snapshots from anon;
revoke all on public.sound_metric_snapshots from anon;
revoke all on public.reports from anon;
revoke all on public.sync_jobs from anon;

grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.creators to authenticated;
grant select, insert, update, delete on public.campaign_creators to authenticated;
grant select, insert, update, delete on public.videos to authenticated;
grant select, insert, update, delete on public.video_metric_snapshots to authenticated;
grant select, insert, update, delete on public.sound_metric_snapshots to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select, insert, update, delete on public.sync_jobs to authenticated;

-- RLS remains enabled (set in initial schema). Policies below gate row access.

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------

drop policy if exists campaigns_authenticated_select on public.campaigns;
drop policy if exists campaigns_authenticated_insert on public.campaigns;
drop policy if exists campaigns_authenticated_update on public.campaigns;
drop policy if exists campaigns_authenticated_delete on public.campaigns;

create policy campaigns_authenticated_select
  on public.campaigns
  for select
  to authenticated
  using (true);

create policy campaigns_authenticated_insert
  on public.campaigns
  for insert
  to authenticated
  with check (true);

create policy campaigns_authenticated_update
  on public.campaigns
  for update
  to authenticated
  using (true)
  with check (true);

create policy campaigns_authenticated_delete
  on public.campaigns
  for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- creators
-- ---------------------------------------------------------------------------

drop policy if exists creators_authenticated_select on public.creators;
drop policy if exists creators_authenticated_insert on public.creators;
drop policy if exists creators_authenticated_update on public.creators;
drop policy if exists creators_authenticated_delete on public.creators;

create policy creators_authenticated_select
  on public.creators
  for select
  to authenticated
  using (true);

create policy creators_authenticated_insert
  on public.creators
  for insert
  to authenticated
  with check (true);

create policy creators_authenticated_update
  on public.creators
  for update
  to authenticated
  using (true)
  with check (true);

create policy creators_authenticated_delete
  on public.creators
  for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- campaign_creators
-- ---------------------------------------------------------------------------

drop policy if exists campaign_creators_authenticated_select on public.campaign_creators;
drop policy if exists campaign_creators_authenticated_insert on public.campaign_creators;
drop policy if exists campaign_creators_authenticated_update on public.campaign_creators;
drop policy if exists campaign_creators_authenticated_delete on public.campaign_creators;

create policy campaign_creators_authenticated_select
  on public.campaign_creators
  for select
  to authenticated
  using (true);

create policy campaign_creators_authenticated_insert
  on public.campaign_creators
  for insert
  to authenticated
  with check (true);

create policy campaign_creators_authenticated_update
  on public.campaign_creators
  for update
  to authenticated
  using (true)
  with check (true);

create policy campaign_creators_authenticated_delete
  on public.campaign_creators
  for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- videos
-- ---------------------------------------------------------------------------

drop policy if exists videos_authenticated_select on public.videos;
drop policy if exists videos_authenticated_insert on public.videos;
drop policy if exists videos_authenticated_update on public.videos;
drop policy if exists videos_authenticated_delete on public.videos;

create policy videos_authenticated_select
  on public.videos
  for select
  to authenticated
  using (true);

create policy videos_authenticated_insert
  on public.videos
  for insert
  to authenticated
  with check (true);

create policy videos_authenticated_update
  on public.videos
  for update
  to authenticated
  using (true)
  with check (true);

create policy videos_authenticated_delete
  on public.videos
  for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- video_metric_snapshots
-- ---------------------------------------------------------------------------

drop policy if exists video_metric_snapshots_authenticated_select on public.video_metric_snapshots;
drop policy if exists video_metric_snapshots_authenticated_insert on public.video_metric_snapshots;
drop policy if exists video_metric_snapshots_authenticated_update on public.video_metric_snapshots;
drop policy if exists video_metric_snapshots_authenticated_delete on public.video_metric_snapshots;

create policy video_metric_snapshots_authenticated_select
  on public.video_metric_snapshots
  for select
  to authenticated
  using (true);

create policy video_metric_snapshots_authenticated_insert
  on public.video_metric_snapshots
  for insert
  to authenticated
  with check (true);

create policy video_metric_snapshots_authenticated_update
  on public.video_metric_snapshots
  for update
  to authenticated
  using (true)
  with check (true);

create policy video_metric_snapshots_authenticated_delete
  on public.video_metric_snapshots
  for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- sound_metric_snapshots
-- ---------------------------------------------------------------------------

drop policy if exists sound_metric_snapshots_authenticated_select on public.sound_metric_snapshots;
drop policy if exists sound_metric_snapshots_authenticated_insert on public.sound_metric_snapshots;
drop policy if exists sound_metric_snapshots_authenticated_update on public.sound_metric_snapshots;
drop policy if exists sound_metric_snapshots_authenticated_delete on public.sound_metric_snapshots;

create policy sound_metric_snapshots_authenticated_select
  on public.sound_metric_snapshots
  for select
  to authenticated
  using (true);

create policy sound_metric_snapshots_authenticated_insert
  on public.sound_metric_snapshots
  for insert
  to authenticated
  with check (true);

create policy sound_metric_snapshots_authenticated_update
  on public.sound_metric_snapshots
  for update
  to authenticated
  using (true)
  with check (true);

create policy sound_metric_snapshots_authenticated_delete
  on public.sound_metric_snapshots
  for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------

drop policy if exists reports_authenticated_select on public.reports;
drop policy if exists reports_authenticated_insert on public.reports;
drop policy if exists reports_authenticated_update on public.reports;
drop policy if exists reports_authenticated_delete on public.reports;

create policy reports_authenticated_select
  on public.reports
  for select
  to authenticated
  using (true);

create policy reports_authenticated_insert
  on public.reports
  for insert
  to authenticated
  with check (true);

create policy reports_authenticated_update
  on public.reports
  for update
  to authenticated
  using (true)
  with check (true);

create policy reports_authenticated_delete
  on public.reports
  for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- sync_jobs
-- ---------------------------------------------------------------------------

drop policy if exists sync_jobs_authenticated_select on public.sync_jobs;
drop policy if exists sync_jobs_authenticated_insert on public.sync_jobs;
drop policy if exists sync_jobs_authenticated_update on public.sync_jobs;
drop policy if exists sync_jobs_authenticated_delete on public.sync_jobs;

create policy sync_jobs_authenticated_select
  on public.sync_jobs
  for select
  to authenticated
  using (true);

create policy sync_jobs_authenticated_insert
  on public.sync_jobs
  for insert
  to authenticated
  with check (true);

create policy sync_jobs_authenticated_update
  on public.sync_jobs
  for update
  to authenticated
  using (true)
  with check (true);

create policy sync_jobs_authenticated_delete
  on public.sync_jobs
  for delete
  to authenticated
  using (true);
