"use server";

import { revalidatePath } from "next/cache";

import { SoundSyncError } from "@/features/sound-sync/errors";
import { getSoundMetricSnapshotById } from "@/features/sound-sync/queries";
import { syncTikTokSound } from "@/features/sound-sync/services/sync-tiktok-sound";
import { assertApprovedTikTokSoundUrl } from "@/lib/providers/tiktok/sound-url";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return supabase;
}

function revalidateSoundPaths(campaignId: string) {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/report`);
  revalidatePath(`/campaigns/${campaignId}/reports`);
}

export type UpdateSoundUrlState = {
  error?: string;
  success?: string;
  values?: { soundUrl: string };
};

export async function updateCampaignSoundUrlAction(
  campaignId: string,
  _prev: UpdateSoundUrlState,
  formData: FormData
): Promise<UpdateSoundUrlState> {
  if (!UUID_PATTERN.test(campaignId)) {
    return { error: "Geçersiz kampanya kimliği." };
  }

  const soundUrl = String(formData.get("soundUrl") ?? "").trim();

  if (!soundUrl) {
    return {
      error: new SoundSyncError("sound_url_missing").message,
      values: { soundUrl },
    };
  }

  let normalizedUrl: string;
  let soundId: string | null;

  try {
    const normalized = assertApprovedTikTokSoundUrl(soundUrl);
    normalizedUrl = normalized.normalizedUrl;
    soundId = normalized.soundId;
  } catch (error) {
    const message =
      error instanceof TikTokProviderError
        ? error.toUserMessage()
        : new SoundSyncError("invalid_sound_url").message;

    return { error: message, values: { soundUrl } };
  }

  const supabase = await requireAuthenticatedClient();

  const { error } = await supabase
    .from("campaigns")
    .update({
      sound_url: normalizedUrl,
      tiktok_sound_id: soundId,
      sound_sync_status: "pending",
      sound_sync_error: null,
    })
    .eq("id", campaignId);

  if (error) {
    return {
      error: "Kampanya ses bağlantısı kaydedilemedi.",
      values: { soundUrl },
    };
  }

  revalidateSoundPaths(campaignId);

  return {
    success: "TikTok ses bağlantısı kaydedildi.",
    values: { soundUrl: normalizedUrl },
  };
}

export async function syncTikTokSoundAction(
  campaignId: string
): Promise<{ error?: string; success?: string }> {
  if (!UUID_PATTERN.test(campaignId)) {
    return { error: "Geçersiz kampanya kimliği." };
  }

  const result = await syncTikTokSound(campaignId);

  if (result.outcome === "failed") {
    return { error: result.message };
  }

  return { success: result.message };
}

export async function deleteSoundMetricSnapshotAction(
  snapshotId: string
): Promise<{ error?: string }> {
  if (!UUID_PATTERN.test(snapshotId)) {
    return { error: "Geçersiz kayıt kimliği." };
  }

  const snapshot = await getSoundMetricSnapshotById(snapshotId);

  if (!snapshot) {
    return { error: "Ses metrik kaydı bulunamadı." };
  }

  const supabase = await requireAuthenticatedClient();

  const { error } = await supabase
    .from("sound_metric_snapshots")
    .delete()
    .eq("id", snapshotId);

  if (error) {
    return { error: "Ses kullanım kaydı silinemedi." };
  }

  revalidateSoundPaths(snapshot.campaign_id);
  return {};
}
