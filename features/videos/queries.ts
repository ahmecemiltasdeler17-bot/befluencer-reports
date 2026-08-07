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

const videoWithCreatorSelect = `
  *,
  creator:creators (
    id,
    username,
    display_name,
    avatar_url,
    platform
  )
`;

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

  return (data ?? []).map((row) => ({
    ...(row as Video),
    creator: row.creator as VideoWithCreator["creator"],
  }));
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

  return (data ?? []).map((row) => ({
    ...(row as Video),
    creator: row.creator as VideoWithCreator["creator"],
  }));
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

  return {
    ...(data as Video),
    creator: data.creator as VideoWithCreator["creator"],
    campaign: data.campaign as VideoWithRelations["campaign"],
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
