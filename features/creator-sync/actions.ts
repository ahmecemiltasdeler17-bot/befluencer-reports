"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { listCampaignIdsForCreator } from "@/features/creator-sync/queries";
import {
  syncCampaignTikTokCreators,
  syncTikTokCreator,
} from "@/features/creator-sync/services/sync-tiktok-creator";
import type { CreatorSyncActionState } from "@/features/creator-sync/types";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    redirect("/login");
  }

  return supabase;
}

export async function syncTikTokCreatorAction(
  creatorId: string
): Promise<CreatorSyncActionState> {
  await requireAuthenticatedClient();

  if (!UUID_PATTERN.test(creatorId)) {
    return { error: "Geçersiz içerik üreticisi kimliği." };
  }

  const result = await syncTikTokCreator(creatorId);

  if (result.outcome === "failed") {
    return { error: result.message, result };
  }

  return { success: result.message, result };
}

export async function syncCampaignTikTokCreatorsAction(
  campaignId: string
): Promise<CreatorSyncActionState> {
  await requireAuthenticatedClient();

  if (!UUID_PATTERN.test(campaignId)) {
    return { error: "Geçersiz kampanya kimliği." };
  }

  const result = await syncCampaignTikTokCreators(campaignId);

  if (result.failed > 0 && result.success === 0) {
    return { error: result.message, result };
  }

  return { success: result.message, result };
}

/**
 * Removes one historical follower snapshot.
 *
 * The table grants DELETE but not UPDATE, so correcting a bad row means deleting
 * it. Deleting the earliest row moves the growth baseline forward, which is why
 * the UI asks for confirmation.
 */
export async function deleteCreatorMetricSnapshotAction(
  snapshotId: string
): Promise<{ error?: string; success?: string }> {
  const supabase = await requireAuthenticatedClient();

  if (!UUID_PATTERN.test(snapshotId)) {
    return { error: "Geçersiz kayıt kimliği." };
  }

  const { data: snapshot, error: readError } = await supabase
    .from("creator_metric_snapshots")
    .select("creator_id")
    .eq("id", snapshotId)
    .maybeSingle();

  if (readError) {
    return { error: "Kayıt bulunamadı." };
  }

  if (!snapshot) {
    return { error: "Kayıt bulunamadı." };
  }

  const creatorId = snapshot.creator_id as string;

  const { error } = await supabase
    .from("creator_metric_snapshots")
    .delete()
    .eq("id", snapshotId);

  if (error) {
    return { error: "Kayıt silinemedi." };
  }

  revalidatePath("/creators");
  revalidatePath(`/creators/${creatorId}`);

  for (const campaignId of await listCampaignIdsForCreator(creatorId)) {
    revalidatePath(`/campaigns/${campaignId}`);
  }

  return { success: "Takipçi kaydı silindi." };
}
