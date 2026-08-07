import "server-only";

import { revalidatePath } from "next/cache";

import { GENERATION_MAX_VERSION_RETRIES } from "@/features/report-generation/constants";
import {
  getNextVersionNumber,
  isDuplicateContentHash,
} from "@/features/report-generation/calculations";
import {
  getLatestComparableReportVersion,
  getMaxVersionNumber,
  getOrCreateReportSeries,
} from "@/features/report-generation/queries";
import { ReportSnapshotValidationError } from "@/features/report-generation/schemas";
import { hashReportSnapshot } from "@/features/report-generation/services/hash-report-snapshot";
import {
  buildReportContentSnapshot,
  finalizeReportSnapshot,
} from "@/features/report-generation/services/serialize-report-snapshot";
import type { GenerateReportResult } from "@/features/report-generation/types";
import { getCampaignReportData } from "@/features/reports/queries";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function mapMutationError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  return "Rapor sürümü oluşturulamadı.";
}

async function requireAuthClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return { supabase, auth };
}

function revalidateReportPaths(campaignId: string) {
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/report`);
  revalidatePath(`/campaigns/${campaignId}/reports`);
}

export async function generateCampaignReportVersion(
  campaignId: string
): Promise<GenerateReportResult> {
  const { supabase, auth } = await requireAuthClient();

  let liveReport;

  try {
    liveReport = await getCampaignReportData(campaignId);
  } catch {
    return {
      outcome: "failed",
      message: "Kampanya bulunamadı.",
      versionId: null,
      versionNumber: null,
    };
  }

  const series = await getOrCreateReportSeries(campaignId);
  const reportNumber =
    series.report_number ?? liveReport.metadata.reportNumber ?? "—";
  const sourceLastSyncedAt =
    liveReport.metadata.freshness.lastSuccessfulSyncAt ?? null;

  // Stage A: validate and hash content before any row is created, so a
  // serialization failure never leaves a row stuck in `generating`.
  let contentSnapshot;

  try {
    contentSnapshot = buildReportContentSnapshot(liveReport, {
      reportId: series.id,
      reportNumber,
      sourceLastSyncedAt,
    });
  } catch {
    return {
      outcome: "failed",
      message: "Rapor anlık görüntüsü doğrulanamadı.",
      versionId: null,
      versionNumber: null,
    };
  }

  const contentHash = hashReportSnapshot(contentSnapshot);
  const latestComparable = await getLatestComparableReportVersion(campaignId);

  if (isDuplicateContentHash(latestComparable?.content_hash, contentHash)) {
    return {
      outcome: "duplicate",
      message:
        "Rapor verilerinde değişiklik olmadığı için yeni sürüm oluşturulmadı.",
      versionId: latestComparable?.id ?? null,
      versionNumber: latestComparable?.version_number ?? null,
    };
  }

  let versionId: string | null = null;
  let versionNumber: number | null = null;

  for (let attempt = 0; attempt <= GENERATION_MAX_VERSION_RETRIES; attempt += 1) {
    const maxVersion = await getMaxVersionNumber(series.id);
    versionNumber = getNextVersionNumber(maxVersion);

    const { data: inserted, error: insertError } = await supabase
      .from("report_versions")
      .insert({
        report_id: series.id,
        campaign_id: campaignId,
        version_number: versionNumber,
        status: "generating",
        generated_by: auth.subject,
        source_last_synced_at: sourceLastSyncedAt,
        source_video_count: liveReport.videos.length,
        source_creator_count: liveReport.creators.length,
        snapshot_schema_version: 1,
        snapshot: {},
      })
      .select("id")
      .single();

    if (insertError) {
      if (
        insertError.code === "23505" &&
        attempt < GENERATION_MAX_VERSION_RETRIES
      ) {
        continue;
      }

      return {
        outcome: "failed",
        message: mapMutationError(insertError.message),
        versionId: null,
        versionNumber: null,
      };
    }

    versionId = inserted.id as string;
    break;
  }

  if (!versionId || !versionNumber) {
    return {
      outcome: "failed",
      message: "Rapor sürüm numarası ayrılamadı.",
      versionId: null,
      versionNumber: null,
    };
  }

  try {
    const generatedAt = new Date().toISOString();
    // Stage B: attach the real version metadata to the validated content.
    const finalSnapshot = finalizeReportSnapshot(contentSnapshot, {
      versionNumber,
      reportVersionId: versionId,
      generatedAt,
      generatedBy: auth.subject,
    });

    const { error: updateVersionError } = await supabase
      .from("report_versions")
      .update({
        status: "ready",
        snapshot: finalSnapshot,
        content_hash: contentHash,
        generated_at: generatedAt,
      })
      .eq("id", versionId);

    if (updateVersionError) {
      throw new Error(updateVersionError.message);
    }

    await supabase
      .from("reports")
      .update({
        generated_at: generatedAt,
        last_updated_at: generatedAt,
        report_number: reportNumber === "—" ? series.report_number : reportNumber,
      })
      .eq("id", series.id);

    revalidateReportPaths(campaignId);

    return {
      outcome: "created",
      message: `Rapor sürüm ${versionNumber} oluşturuldu.`,
      versionId,
      versionNumber,
    };
  } catch (error) {
    let message = "Rapor sürümü oluşturulamadı.";

    if (error instanceof ReportSnapshotValidationError) {
      message = error.message;
    } else if (error instanceof Error) {
      message = mapMutationError(error.message);
    }

    await supabase
      .from("report_versions")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", versionId);

    revalidateReportPaths(campaignId);

    return {
      outcome: "failed",
      message,
      versionId,
      versionNumber,
    };
  }
}
