-- BeFluencer Reports — campaign TikTok sound cover artwork
--
-- Stores the provider-returned cover image URL for a campaign sound.
-- Never fabricate artwork; leave null when the provider omits a cover.

alter table public.campaigns
  add column if not exists tiktok_sound_cover_url text;

comment on column public.campaigns.tiktok_sound_cover_url is
  'TikTok sound cover image URL from the provider when available. Null when absent; never invent artwork.';
