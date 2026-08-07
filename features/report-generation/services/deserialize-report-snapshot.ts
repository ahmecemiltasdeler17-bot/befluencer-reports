import { parseReportSnapshot } from "@/features/report-generation/schemas";
import type { ReportSnapshot } from "@/features/report-generation/schemas";
import type { CampaignReportData } from "@/features/reports/types";

export function deserializeReportSnapshot(input: unknown): ReportSnapshot {
  return parseReportSnapshot(input);
}

export function snapshotToCampaignReportData(
  snapshot: ReportSnapshot
): CampaignReportData {
  return {
    ...snapshot.data,
    featuredVideo: snapshot.data.featuredVideo,
    topVideo: snapshot.data.featuredVideo,
  };
}

export function parseSnapshotForRendering(input: unknown): CampaignReportData {
  const snapshot = deserializeReportSnapshot(input);
  return snapshotToCampaignReportData(snapshot);
}
