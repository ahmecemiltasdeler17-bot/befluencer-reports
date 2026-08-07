"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCampaignById } from "@/features/campaigns/queries";
import { getCampaignCreator } from "@/features/creators/queries";
import {
  getVideoById,
  getVideoSnapshotCount,
} from "@/features/videos/queries";
import {
  statusToDb,
  toIsoTimestamp,
  toVideoFormValues,
  videoFormSchema,
  parseVideoFormData,
} from "@/features/videos/schemas";
import type { VideoFormState } from "@/features/videos/types";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function mapSupabaseMutationError(message: string, code?: string): string {
  if (code === "23505" || message.toLowerCase().includes("duplicate")) {
    return "Bu video URL'si zaten kayıtlı.";
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  if (normalized.includes("jwt")) {
    return "Oturumunuz geçersiz. Lütfen tekrar giriş yapın.";
  }

  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    redirect("/login");
  }

  return supabase;
}

function collectFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

async function assertCampaignExists(campaignId: string) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    redirect("/campaigns");
  }
  return campaign;
}

async function assertCreatorInCampaign(campaignId: string, creatorId: string) {
  const assignment = await getCampaignCreator(campaignId, creatorId);

  if (!assignment) {
    return false;
  }

  return true;
}

function revalidateVideoPaths(campaignId: string, videoId?: string) {
  revalidatePath(`/campaigns/${campaignId}`);

  if (videoId) {
    revalidatePath(`/campaigns/${campaignId}/videos/${videoId}`);
    revalidatePath(`/campaigns/${campaignId}/videos/${videoId}/edit`);
  }

  revalidatePath(`/campaigns/${campaignId}/videos/new`);
}

export async function createVideo(
  campaignId: string,
  _prevState: VideoFormState,
  formData: FormData
): Promise<VideoFormState> {
  await assertCampaignExists(campaignId);

  const raw = parseVideoFormData(formData);
  const parsed = videoFormSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      values: raw as VideoFormState["values"],
    };
  }

  if (!(await assertCreatorInCampaign(campaignId, parsed.data.creator_id))) {
    return {
      error: "Seçilen içerik üreticisi bu kampanyaya atanmamış.",
      values: toVideoFormValues(parsed.data),
    };
  }

  const supabase = await requireAuthenticatedClient();
  const values = parsed.data;

  const { data, error } = await supabase
    .from("videos")
    .insert({
      campaign_id: campaignId,
      creator_id: values.creator_id,
      platform: values.platform,
      video_url: values.video_url,
      platform_video_id: values.platform_video_id,
      caption: values.caption,
      published_at: toIsoTimestamp(values.published_at),
      status: statusToDb(values.status),
    })
    .select("id")
    .single();

  if (error) {
    return {
      error: mapSupabaseMutationError(error.message, error.code),
      values: toVideoFormValues(values),
    };
  }

  revalidateVideoPaths(campaignId, data.id);
  redirect(`/campaigns/${campaignId}/videos/${data.id}`);
}

export async function updateVideo(
  campaignId: string,
  videoId: string,
  _prevState: VideoFormState,
  formData: FormData
): Promise<VideoFormState> {
  await assertCampaignExists(campaignId);

  const existing = await getVideoById(videoId);
  if (!existing || existing.campaign_id !== campaignId) {
    redirect(`/campaigns/${campaignId}`);
  }

  const raw = parseVideoFormData(formData);
  const parsed = videoFormSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      values: raw as VideoFormState["values"],
    };
  }

  if (!(await assertCreatorInCampaign(campaignId, parsed.data.creator_id))) {
    return {
      error: "Seçilen içerik üreticisi bu kampanyaya atanmamış.",
      values: toVideoFormValues(parsed.data),
    };
  }

  const supabase = await requireAuthenticatedClient();
  const values = parsed.data;

  const { error } = await supabase
    .from("videos")
    .update({
      creator_id: values.creator_id,
      platform: values.platform,
      video_url: values.video_url,
      platform_video_id: values.platform_video_id,
      caption: values.caption,
      published_at: toIsoTimestamp(values.published_at),
      status: statusToDb(values.status),
    })
    .eq("id", videoId)
    .eq("campaign_id", campaignId);

  if (error) {
    return {
      error: mapSupabaseMutationError(error.message, error.code),
      values: toVideoFormValues(values),
    };
  }

  revalidateVideoPaths(campaignId, videoId);
  redirect(`/campaigns/${campaignId}/videos/${videoId}`);
}

export async function deleteVideo(
  campaignId: string,
  videoId: string
): Promise<{ error?: string; softDeleted?: boolean }> {
  await assertCampaignExists(campaignId);

  const existing = await getVideoById(videoId);
  if (!existing || existing.campaign_id !== campaignId) {
    return { error: "Video bulunamadı." };
  }

  const supabase = await requireAuthenticatedClient();
  const snapshotCount = await getVideoSnapshotCount(videoId);

  if (snapshotCount > 0) {
    const { error } = await supabase
      .from("videos")
      .update({ status: "unavailable" })
      .eq("id", videoId)
      .eq("campaign_id", campaignId);

    if (error) {
      return { error: mapSupabaseMutationError(error.message, error.code) };
    }

    revalidateVideoPaths(campaignId, videoId);
    return { softDeleted: true };
  }

  const { error } = await supabase
    .from("videos")
    .delete()
    .eq("id", videoId)
    .eq("campaign_id", campaignId);

  if (error) {
    return { error: mapSupabaseMutationError(error.message, error.code) };
  }

  revalidateVideoPaths(campaignId);
  return {};
}
