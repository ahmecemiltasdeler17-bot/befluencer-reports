"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { SyncActionState } from "@/features/sync/types";
import {
  syncCampaignTikTokVideos,
  syncTikTokVideo,
} from "@/features/sync/services/sync-tiktok-video";
import { getVideoById } from "@/features/videos/queries";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

async function requireAuth() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    redirect("/login");
  }
}

export async function syncTikTokVideoAction(
  campaignId: string,
  videoId: string
): Promise<SyncActionState> {
  await requireAuth();

  const video = await getVideoById(videoId);

  if (!video || video.campaign_id !== campaignId) {
    return { error: "Video bulunamadı." };
  }

  const result = await syncTikTokVideo(videoId);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/videos/${videoId}`);

  if (result.outcome === "failed") {
    return { error: result.message, result };
  }

  return { success: result.message, result };
}

export async function syncCampaignTikTokVideosAction(
  campaignId: string
): Promise<SyncActionState> {
  await requireAuth();

  const result = await syncCampaignTikTokVideos(campaignId);

  revalidatePath(`/campaigns/${campaignId}`);

  if (result.failed > 0 && result.success === 0) {
    return { error: result.message, result };
  }

  return { success: result.message, result };
}
