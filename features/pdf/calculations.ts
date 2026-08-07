import { ReportPdfError } from "@/features/pdf/errors";
import type { PrintReportPayload } from "@/features/pdf/types";
import { parseReportSnapshot } from "@/features/report-generation/schemas";
import { snapshotToCampaignReportData } from "@/features/report-generation/services/deserialize-report-snapshot";

export const EXPORTABLE_STATUSES = ["ready", "archived"] as const;

export type ExportableStatus = (typeof EXPORTABLE_STATUSES)[number];

export function isExportableVersionStatus(
  status: string
): status is ExportableStatus {
  return (EXPORTABLE_STATUSES as readonly string[]).includes(status);
}

/** Throws typed errors so callers never leak Supabase details. */
export function assertExportableVersion(row: {
  campaign_id: string;
  status: string;
} | null, campaignId: string): asserts row is { campaign_id: string; status: string } {
  if (!row || row.campaign_id !== campaignId) {
    throw new ReportPdfError("report_not_found", "Version missing or campaign mismatch");
  }

  if (!isExportableVersionStatus(row.status)) {
    throw new ReportPdfError("report_not_ready", `status=${row.status}`);
  }
}

/**
 * Builds the print payload from the stored snapshot alone.
 *
 * No live campaign, creator, video, metric or sound table is consulted, so a
 * historical export always reproduces the exact values that were generated.
 */
export function buildPrintPayloadFromSnapshot(input: {
  reportVersionId: string;
  campaignId: string;
  versionNumber: number;
  status: string;
  generatedAt: string | null;
  sourceLastSyncedAt: string | null;
  campaignName: string | null;
  reportNumber: string | null;
  snapshot: unknown;
}): PrintReportPayload {
  if (!isExportableVersionStatus(input.status)) {
    throw new ReportPdfError("report_not_ready", `status=${input.status}`);
  }

  let snapshot;

  try {
    snapshot = parseReportSnapshot(input.snapshot);
  } catch {
    throw new ReportPdfError("invalid_snapshot", "Snapshot failed schema validation");
  }

  const report = snapshotToCampaignReportData(snapshot);

  return {
    reportVersionId: input.reportVersionId,
    campaignId: input.campaignId,
    versionNumber: snapshot.reportMetadata.versionNumber || input.versionNumber,
    status: input.status,
    generatedAt: snapshot.reportMetadata.generatedAt ?? input.generatedAt,
    sourceLastSyncedAt:
      snapshot.reportMetadata.sourceLastSyncedAt ?? input.sourceLastSyncedAt,
    campaignName: report.campaign.name || (input.campaignName ?? "—"),
    reportNumber:
      snapshot.reportMetadata.reportNumber || (input.reportNumber ?? "—"),
    report,
  };
}
