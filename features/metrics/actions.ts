"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCampaignById } from "@/features/campaigns/queries";
import {
  engagementExceedsViewsWarning,
  parseSoundMetricFormData,
  parseVideoMetricFormData,
  soundMetricFormSchema,
  toIsoTimestamp,
  toSoundMetricFormValues,
  toVideoMetricFormValues,
  videoMetricFormSchema,
} from "@/features/metrics/schemas";
import {
  getSoundMetricSnapshotById,
  getVideoMetricSnapshotById,
} from "@/features/metrics/queries";
import type {
  SoundMetricFormState,
  VideoMetricFormState,
} from "@/features/metrics/types";
import { getVideoById } from "@/features/videos/queries";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function mapSupabaseMutationError(message: string, code?: string): string {
  if (code === "23505" || message.toLowerCase().includes("duplicate")) {
    return "Bu yakalanma zamanı için zaten bir kayıt var.";
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

function revalidateVideoMetricPaths(campaignId: string, videoId: string) {
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/videos/${videoId}`);
  revalidatePath(`/campaigns/${campaignId}/videos/${videoId}/metrics/new`);
}

function revalidateSoundMetricPaths(campaignId: string) {
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/sound-metrics/new`);
}

async function assertVideoForMetrics(campaignId: string, videoId: string) {
  const video = await getVideoById(videoId);

  if (!video || video.campaign_id !== campaignId) {
    redirect(`/campaigns/${campaignId}`);
  }

  if (video.status === "unavailable") {
    return { ok: false as const, error: "Kaldırılmış videolara metrik eklenemez." };
  }

  return { ok: true as const, video };
}

export async function createVideoMetricSnapshot(
  campaignId: string,
  videoId: string,
  _prevState: VideoMetricFormState,
  formData: FormData
): Promise<VideoMetricFormState> {
  const videoCheck = await assertVideoForMetrics(campaignId, videoId);

  if (!videoCheck.ok) {
    return { error: videoCheck.error };
  }

  const raw = parseVideoMetricFormData(formData);
  const parsed = videoMetricFormSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      values: raw,
    };
  }

  const warning = engagementExceedsViewsWarning(parsed.data);
  const supabase = await requireAuthenticatedClient();
  const values = parsed.data;

  const { error } = await supabase.from("video_metric_snapshots").insert({
    video_id: videoId,
    views: values.views,
    likes: values.likes,
    comments: values.comments,
    shares: values.shares,
    saves: values.saves,
    captured_at: toIsoTimestamp(values.captured_at),
  });

  if (error) {
    return {
      error: mapSupabaseMutationError(error.message, error.code),
      warning,
      values: toVideoMetricFormValues(values),
    };
  }

  revalidateVideoMetricPaths(campaignId, videoId);
  redirect(`/campaigns/${campaignId}/videos/${videoId}`);
}

export async function createSoundMetricSnapshot(
  campaignId: string,
  _prevState: SoundMetricFormState,
  formData: FormData
): Promise<SoundMetricFormState> {
  const campaign = await getCampaignById(campaignId);

  if (!campaign) {
    redirect("/campaigns");
  }

  const raw = parseSoundMetricFormData(formData);
  const parsed = soundMetricFormSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      values: raw,
    };
  }

  const supabase = await requireAuthenticatedClient();
  const values = parsed.data;

  const { error } = await supabase.from("sound_metric_snapshots").insert({
    campaign_id: campaignId,
    usage_count: values.usage_count,
    captured_at: toIsoTimestamp(values.captured_at),
    source: "manual",
  });

  if (error) {
    return {
      error: mapSupabaseMutationError(error.message, error.code),
      values: toSoundMetricFormValues(values),
    };
  }

  revalidateSoundMetricPaths(campaignId);
  redirect(`/campaigns/${campaignId}#sound-tracking`);
}

export async function deleteVideoMetricSnapshot(
  snapshotId: string
): Promise<{ error?: string }> {
  const snapshot = await getVideoMetricSnapshotById(snapshotId);

  if (!snapshot) {
    return { error: "Metrik kaydı bulunamadı." };
  }

  const supabase = await requireAuthenticatedClient();

  const { error } = await supabase
    .from("video_metric_snapshots")
    .delete()
    .eq("id", snapshotId);

  if (error) {
    return { error: mapSupabaseMutationError(error.message, error.code) };
  }

  revalidateVideoMetricPaths(snapshot.campaign_id, snapshot.video_id);
  return {};
}

export async function deleteSoundMetricSnapshot(
  snapshotId: string
): Promise<{ error?: string }> {
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
    return { error: mapSupabaseMutationError(error.message, error.code) };
  }

  revalidateSoundMetricPaths(snapshot.campaign_id);
  return {};
}
