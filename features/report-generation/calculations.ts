import type { ReportVersionRow, ReportVersionSummary } from "@/features/report-generation/types";
import { parseReportSnapshot } from "@/features/report-generation/schemas";

export function mapReportVersionSummary(row: ReportVersionRow): ReportVersionSummary {
  let totalViews: number | null = null;
  let engagementRate: number | null = null;

  if (row.status === "ready" || row.status === "archived") {
    try {
      const snapshot = parseReportSnapshot(row.snapshot);
      totalViews = snapshot.data.totalReach.value;
      const engagementKpi = snapshot.data.kpis.find(
        (kpi) => kpi.id === "engagement-rate"
      );
      engagementRate = engagementKpi?.value ?? null;
    } catch {
      totalViews = null;
      engagementRate = null;
    }
  }

  return {
    id: row.id,
    versionNumber: row.version_number,
    status: row.status,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    sourceLastSyncedAt: row.source_last_synced_at,
    sourceVideoCount: row.source_video_count,
    sourceCreatorCount: row.source_creator_count,
    totalViews,
    engagementRate,
    errorMessage: row.error_message,
    archivedAt: row.archived_at,
  };
}

export function getNextVersionNumber(currentMax: number | null): number {
  return (currentMax ?? 0) + 1;
}

export function isDuplicateContentHash(
  latestHash: string | null | undefined,
  nextHash: string
): boolean {
  return Boolean(latestHash && latestHash === nextHash);
}

export function extractEngagementRateFromSnapshot(snapshot: unknown): number | null {
  try {
    const parsed = parseReportSnapshot(snapshot);
    return parsed.data.kpis.find((kpi) => kpi.id === "engagement-rate")?.value ?? null;
  } catch {
    return null;
  }
}

export function extractTotalViewsFromSnapshot(snapshot: unknown): number | null {
  try {
    const parsed = parseReportSnapshot(snapshot);
    return parsed.data.totalReach.value;
  } catch {
    return null;
  }
}
