import { z } from "zod";

import { REPORT_SNAPSHOT_SCHEMA_VERSION } from "@/features/report-generation/constants";

/** Finite numbers only — rejects NaN and Infinity that JSON cannot represent. */
const finiteNumber = z
  .number()
  .refine((value) => Number.isFinite(value), "Sayısal değer geçerli değil.");

const nonNegativeInt = z.number().int().min(0);

const platformSchema = z.enum(["tiktok", "instagram", "youtube"]);
const creatorCategorySchema = z.enum([
  "nano",
  "micro",
  "macro",
  "mega",
  "template",
  "uncategorized",
]);
const campaignStatusSchema = z.enum(["active", "completed", "draft", "paused"]);

const kpiMetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: finiteNumber,
  previousValue: finiteNumber,
  format: z.enum(["number", "percent", "compact"]),
  suffix: z.string().optional(),
});

const campaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  track: z.string(),
  client: z.string(),
  status: campaignStatusSchema,
  startDate: z.string(),
  endDate: z.string(),
  soundUrl: z.string(),
  coverColor: z.string(),
});

const totalReachSchema = z.object({
  value: finiteNumber,
  previousValue: finiteNumber,
  label: z.string(),
  /** Null when the campaign has no historical aggregate to compare against. */
  growthSinceStart: finiteNumber.nullable(),
});

const videoSchema = z.object({
  id: z.string(),
  title: z.string(),
  creatorHandle: z.string(),
  creatorName: z.string(),
  /** Empty string when the creator has no avatar — media fallback handles it. */
  creatorAvatar: z.string(),
  /** Empty string when the video has no thumbnail — media fallback handles it. */
  thumbnail: z.string(),
  platform: platformSchema,
  views: finiteNumber,
  likes: finiteNumber,
  comments: finiteNumber,
  shares: finiteNumber,
  saves: finiteNumber,
  engagementRate: finiteNumber,
  publishedAt: z.string(),
  url: z.string(),
  category: creatorCategorySchema,
  hasMetrics: z.boolean().optional(),
  /**
   * Added in Phase 9. Optional so snapshots created before report links existed
   * remain valid and readable — they simply render without a creator link.
   */
  creatorProfileUrl: z.string().nullable().optional(),
});

const creatorSchema = z.object({
  id: z.string(),
  rank: finiteNumber,
  handle: z.string(),
  displayName: z.string(),
  avatar: z.string(),
  followers: finiteNumber,
  videos: finiteNumber,
  views: finiteNumber,
  engagement: finiteNumber,
  engagementRate: finiteNumber,
  category: creatorCategorySchema,
  /** Added in Phase 9 — optional for backward compatibility. */
  platform: platformSchema.optional(),
  /** Added in Phase 9 — optional for backward compatibility. */
  profileUrl: z.string().nullable().optional(),
});

const trendPointSchema = z.object({
  date: z.string(),
  views: finiteNumber,
  engagement: finiteNumber,
});

const growthPointSchema = z.object({
  date: z.string(),
  views: finiteNumber,
  cumulativeViews: finiteNumber,
});

const soundGrowthSchema = z.object({
  soundName: z.string(),
  initialUses: finiteNumber,
  currentUses: finiteNumber,
  /** Zero when initial usage is zero — multiplier is not meaningful then. */
  multiplier: finiteNumber,
  /** Optional: older snapshots omit these fields. */
  absoluteGrowth: finiteNumber.optional(),
  growthPercentage: finiteNumber.nullable().optional(),
  soundId: z.string().nullable().optional(),
  soundAuthor: z.string().nullable().optional(),
  soundUrl: z.string().nullable().optional(),
  timeline: z.array(
    z.object({
      date: z.string(),
      uses: finiteNumber,
    })
  ),
});

const freshnessSchema = z.object({
  /** Null when no video has ever synced successfully. */
  lastSuccessfulSyncAt: z.string().nullable(),
  videosWithoutMetrics: nonNegativeInt,
  staleVideoCount: nonNegativeInt,
});

const sourceCountsSchema = z.object({
  videoCount: nonNegativeInt,
  creatorCount: nonNegativeInt,
});

const reportDataSchema = z.object({
  campaign: campaignSchema,
  totalReach: totalReachSchema,
  summary: z.object({
    headline: z.string(),
    paragraphs: z.array(z.string()),
  }),
  kpis: z.array(kpiMetricSchema),
  trend: z.array(trendPointSchema),
  growth: z.array(growthPointSchema),
  platforms: z.array(
    z.object({
      platform: platformSchema,
      label: z.string(),
      value: finiteNumber,
      percentage: finiteNumber,
      color: z.string(),
    })
  ),
  /** Null when no video has metrics yet. */
  topVideo: videoSchema.nullable(),
  featuredVideo: videoSchema.nullable(),
  creators: z.array(creatorSchema),
  videos: z.array(videoSchema),
  soundGrowth: soundGrowthSchema,
  metadata: z.object({
    reportNumber: z.string(),
    reportDate: z.string(),
    hasReportRecord: z.boolean(),
    freshness: freshnessSchema,
  }),
  hasTimeline: z.boolean(),
  hasSoundTimeline: z.boolean(),
});

/**
 * Report identity known before a version row exists.
 * Version number, version id and generation time are deliberately absent here.
 */
const reportContextSchema = z.object({
  reportId: z.string().min(1),
  reportNumber: z.string(),
  sourceLastSyncedAt: z.string().nullable(),
});

/**
 * Stage A — content snapshot.
 * Validated and hashed before allocating a version number, so a broken
 * snapshot never creates a `report_versions` row.
 */
export const reportContentSnapshotSchema = z.object({
  snapshotSchemaVersion: z.literal(REPORT_SNAPSHOT_SCHEMA_VERSION),
  reportContext: reportContextSchema,
  sourceCounts: sourceCountsSchema,
  data: reportDataSchema,
});

const reportMetadataSchema = reportContextSchema.extend({
  versionNumber: z.number().int().min(1),
  reportVersionId: z.string().min(1),
  generatedAt: z.string().min(1),
  generatedBy: z.string().nullable(),
});

/**
 * Stage B — finalized historical snapshot persisted to `report_versions.snapshot`.
 * Requires real version metadata; never populated with placeholder values.
 */
export const reportSnapshotSchema = z.object({
  snapshotSchemaVersion: z.literal(REPORT_SNAPSHOT_SCHEMA_VERSION),
  reportMetadata: reportMetadataSchema,
  sourceCounts: sourceCountsSchema,
  data: reportDataSchema,
});

export type ReportContentSnapshot = z.infer<typeof reportContentSnapshotSchema>;
export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
export type ReportSnapshotData = z.infer<typeof reportDataSchema>;

/**
 * Logs only issue paths, messages and codes in development.
 * Snapshot values are never logged, so campaign data stays out of server logs.
 */
export function logSnapshotValidationIssues(
  context: string,
  error: z.ZodError
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error(
    context,
    error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }))
  );
}

export class ReportSnapshotValidationError extends Error {
  constructor(message = "Rapor anlık görüntüsü doğrulanamadı.") {
    super(message);
    this.name = "ReportSnapshotValidationError";
  }
}

export function parseReportSnapshot(input: unknown): ReportSnapshot {
  const parsed = reportSnapshotSchema.safeParse(input);

  if (!parsed.success) {
    logSnapshotValidationIssues(
      "Report snapshot validation failed (parse)",
      parsed.error
    );
    throw new ReportSnapshotValidationError("Geçersiz rapor anlık görüntüsü.");
  }

  return parsed.data;
}

export function assertJsonSerializable(value: unknown): void {
  JSON.parse(JSON.stringify(value));
}
