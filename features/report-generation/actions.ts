"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ReportGenerationActionState } from "@/features/report-generation/types";
import { generateCampaignReportVersion } from "@/features/report-generation/services/generate-report-version";
import {
  getReportVersionById,
  hasGeneratingReportVersion,
} from "@/features/report-generation/queries";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

async function requireAuth() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    redirect("/login");
  }

  return supabase;
}

function revalidateReportPaths(campaignId: string) {
  revalidatePath("/");
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/reports`);
  revalidatePath(`/campaigns/${campaignId}/report`);
}

export async function generateReportVersionAction(
  campaignId: string
): Promise<ReportGenerationActionState> {
  await requireAuth();

  const generating = await hasGeneratingReportVersion(campaignId);

  if (generating) {
    return {
      error: "Bir rapor sürümü zaten hazırlanıyor.",
    };
  }

  const result = await generateCampaignReportVersion(campaignId);

  revalidateReportPaths(campaignId);

  if (result.outcome === "failed") {
    return { error: result.message, result };
  }

  if (result.outcome === "duplicate") {
    return { success: result.message, result };
  }

  return { success: result.message, result };
}

export async function archiveReportVersionAction(
  versionId: string
): Promise<ReportGenerationActionState> {
  const supabase = await requireAuth();
  const version = await getReportVersionById(versionId);

  if (!version) {
    return { error: "Rapor sürümü bulunamadı." };
  }

  if (version.status !== "ready") {
    return { error: "Yalnızca hazır rapor sürümleri arşivlenebilir." };
  }

  const archivedAt = new Date().toISOString();
  const { error } = await supabase
    .from("report_versions")
    .update({
      status: "archived",
      archived_at: archivedAt,
    })
    .eq("id", versionId);

  if (error) {
    return { error: "Rapor sürümü arşivlenemedi." };
  }

  revalidateReportPaths(version.campaign_id);
  revalidatePath(`/campaigns/${version.campaign_id}/reports/${versionId}`);

  return { success: "Rapor sürümü arşivlendi." };
}

export async function retryFailedReportVersionAction(
  campaignId: string
): Promise<ReportGenerationActionState> {
  return generateReportVersionAction(campaignId);
}

export async function ensureReportSeriesAction(
  campaignId: string
): Promise<ReportGenerationActionState> {
  await requireAuth();

  const { getOrCreateReportSeries } = await import(
    "@/features/report-generation/queries"
  );

  await getOrCreateReportSeries(campaignId);
  revalidateReportPaths(campaignId);

  return { success: "Rapor serisi oluşturuldu." };
}
