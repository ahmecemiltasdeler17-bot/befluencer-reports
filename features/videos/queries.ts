import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

import type {
  Video,
  VideoWithCreator,
  VideoWithRelations,
} from "@/features/videos/types";
import type { SyncDbClient } from "@/features/sync/db-client";

function mapSupabaseError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  if (normalized.includes("jwt")) {
    return "Oturumunuz geçersiz. Lütfen tekrar giriş yapın.";
  }

  return "Veritabanı hatası oluştu. Lütfen tekrar deneyin.";
}

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return supabase;
}

async function resolveClient(client?: SyncDbClient) {
  return client ?? (await requireAuthenticatedClient());
}

/**
 * Includes preview_media_url / preview_media_type explicitly so report preview
 * management never depends on an implicit schema drift.
 */
const videoWithCreatorSelect = `
  *,
  preview_media_url,
  preview_media_type,
  creator:creators (
    id,
    username,
    display_name,
    avatar_url,
    platform
  )
`;

function mapVideoWithCreator(row: {
  creator: VideoWithCreator["creator"] | VideoWithCreator["creator"][] | null;
} & Record<string, unknown>): VideoWithCreator {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  return {
    ...(row as unknown as Video),
    preview_media_url: (row.preview_media_url as string | null | undefined) ?? null,
    preview_media_type:
      (row.preview_media_type as string | null | undefined) ?? null,
    creator: creator as VideoWithCreator["creator"],
  };
}

export async function listCampaignVideos(
  campaignId: string
): Promise<VideoWithCreator[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("videos")
    .select(videoWithCreatorSelect)
    .eq("campaign_id", campaignId)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []).map((row) => mapVideoWithCreator(row));
}

export async function listCreatorVideos(
  campaignId: string,
  creatorId: string
): Promise<VideoWithCreator[]> {
  const supabase = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("videos")
    .select(videoWithCreatorSelect)
    .eq("campaign_id", campaignId)
    .eq("creator_id", creatorId)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return (data ?? []).map((row) => mapVideoWithCreator(row));
}

export async function getVideoById(
  id: string,
  client?: SyncDbClient
): Promise<VideoWithRelations | null> {
  const supabase = await resolveClient(client);

  const { data, error } = await supabase
    .from("videos")
    .select(
      `
      ${videoWithCreatorSelect},
      campaign:campaigns (id, name)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  if (!data) {
    return null;
  }

  const mapped = mapVideoWithCreator(data);
  const campaign = Array.isArray(data.campaign)
    ? data.campaign[0]
    : data.campaign;

  return {
    ...mapped,
    campaign: campaign as VideoWithRelations["campaign"],
  };
}

export async function getVideoSnapshotCount(videoId: string): Promise<number> {
  const supabase = await requireAuthenticatedClient();

  const { count, error } = await supabase
    .from("video_metric_snapshots")
    .select("*", { count: "exact", head: true })
    .eq("video_id", videoId);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  return count ?? 0;
}
