import { REPORT_SNAPSHOT_SCHEMA_VERSION } from "@/features/report-generation/constants";
import {
  logSnapshotValidationIssues,
  ReportSnapshotValidationError,
  reportContentSnapshotSchema,
  reportSnapshotSchema,
  type ReportContentSnapshot,
  type ReportSnapshot,
} from "@/features/report-generation/schemas";
import {
  ensureArray,
  normalizeReportSnapshotInput,
} from "@/features/report-generation/services/normalize-report-snapshot-input";
import type {
  ReportSnapshotContext,
  ReportVersionMetadata,
} from "@/features/report-generation/types";
import { normalizeCreatorList } from "@/features/reports/normalize-creators";
import type { CampaignReportData } from "@/features/reports/types";

/**
 * Explicit empty state for the sound section. Used only when the campaign has
 * no sound snapshots at all — usage counts stay at zero rather than invented.
 */
function emptySoundGrowth(soundName: string) {
  return {
    soundName,
    initialUses: 0,
    currentUses: 0,
    multiplier: 0,
    timeline: [],
    cluster: {
      initialUses: null,
      currentUses: null,
      multiplier: null,
      absoluteGrowth: null,
      growthPercentage: null,
      timeline: [],
    },
  };
}

function buildSnapshotData(liveReportData: CampaignReportData) {
  const soundGrowth = liveReportData.soundGrowth ?? null;
  const creators = normalizeCreatorList(liveReportData.creators);

  return {
    campaign: liveReportData.campaign,
    totalReach: liveReportData.totalReach,
    summary: {
      headline: liveReportData.summary?.headline ?? "",
      paragraphs: ensureArray(liveReportData.summary?.paragraphs),
    },
    kpis: ensureArray(liveReportData.kpis),
    trend: ensureArray(liveReportData.trend),
    growth: ensureArray(liveReportData.growth),
    platforms: ensureArray(liveReportData.platforms),
    topVideo: liveReportData.topVideo ?? liveReportData.featuredVideo ?? null,
    featuredVideo: liveReportData.featuredVideo ?? null,
    creators,
    videos: ensureArray(liveReportData.videos),
    soundGrowth: soundGrowth
      ? {
          ...soundGrowth,
          timeline: ensureArray(soundGrowth.timeline),
          cluster: soundGrowth.cluster
            ? {
                ...soundGrowth.cluster,
                timeline: ensureArray(soundGrowth.cluster.timeline),
              }
            : soundGrowth.cluster,
        }
      : emptySoundGrowth(liveReportData.campaign.track),
    metadata: liveReportData.metadata,
    hasTimeline: liveReportData.hasTimeline,
    hasSoundTimeline: liveReportData.hasSoundTimeline,
  };
}

/**
 * Stage A — builds and validates the content snapshot. Contains no version
 * metadata, so it can be produced before a `report_versions` row exists.
 */
export function buildReportContentSnapshot(
  liveReportData: CampaignReportData,
  context: ReportSnapshotContext
): ReportContentSnapshot {
  const candidate = normalizeReportSnapshotInput({
    snapshotSchemaVersion: REPORT_SNAPSHOT_SCHEMA_VERSION,
    reportContext: {
      reportId: context.reportId,
      reportNumber: context.reportNumber,
      sourceLastSyncedAt: context.sourceLastSyncedAt,
    },
    sourceCounts: {
      videoCount: ensureArray(liveReportData.videos).length,
      creatorCount: normalizeCreatorList(liveReportData.creators).length,
    },
    data: buildSnapshotData(liveReportData),
  });

  const parsed = reportContentSnapshotSchema.safeParse(candidate);

  if (!parsed.success) {
    logSnapshotValidationIssues(
      "Report content snapshot validation failed",
      parsed.error
    );
    throw new ReportSnapshotValidationError();
  }

  return parsed.data;
}

/**
 * Stage B — attaches real version metadata to a validated content snapshot and
 * validates the finalized historical snapshot.
 */
export function finalizeReportSnapshot(
  contentSnapshot: ReportContentSnapshot,
  versionMetadata: ReportVersionMetadata
): ReportSnapshot {
  const candidate = normalizeReportSnapshotInput({
    snapshotSchemaVersion: contentSnapshot.snapshotSchemaVersion,
    reportMetadata: {
      ...contentSnapshot.reportContext,
      versionNumber: versionMetadata.versionNumber,
      reportVersionId: versionMetadata.reportVersionId,
      generatedAt: versionMetadata.generatedAt,
      generatedBy: versionMetadata.generatedBy,
    },
    sourceCounts: contentSnapshot.sourceCounts,
    data: contentSnapshot.data,
  });

  const parsed = reportSnapshotSchema.safeParse(candidate);

  if (!parsed.success) {
    logSnapshotValidationIssues(
      "Report snapshot validation failed (finalize)",
      parsed.error
    );
    throw new ReportSnapshotValidationError();
  }

  return parsed.data;
}

/** Convenience wrapper for both stages when version metadata is already known. */
export function serializeReportSnapshot(
  liveReportData: CampaignReportData,
  metadata: ReportSnapshotContext & ReportVersionMetadata
): ReportSnapshot {
  const contentSnapshot = buildReportContentSnapshot(liveReportData, metadata);

  return finalizeReportSnapshot(contentSnapshot, metadata);
}
