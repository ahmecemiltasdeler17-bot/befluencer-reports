import type { ReportVersionStatus } from "@/features/report-generation/constants";
import type { CampaignReportData } from "@/features/reports/types";

export type {
  ReportContentSnapshot,
  ReportSnapshot,
} from "@/features/report-generation/schemas";
export type { ReportVersionStatus } from "@/features/report-generation/constants";

export type ReportSeries = {
  id: string;
  campaign_id: string;
  report_number: string | null;
  public_slug: string | null;
  is_public: boolean;
  generated_at: string | null;
  last_updated_at: string | null;
  created_at: string;
};

export type ReportVersionRow = {
  id: string;
  report_id: string;
  campaign_id: string;
  version_number: number;
  status: ReportVersionStatus;
  generated_at: string | null;
  generated_by: string | null;
  source_last_synced_at: string | null;
  source_video_count: number;
  source_creator_count: number;
  snapshot_schema_version: number;
  snapshot: unknown;
  content_hash: string | null;
  error_message: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportVersionSummary = {
  id: string;
  versionNumber: number;
  status: ReportVersionStatus;
  generatedAt: string | null;
  generatedBy: string | null;
  sourceLastSyncedAt: string | null;
  sourceVideoCount: number;
  sourceCreatorCount: number;
  totalViews: number | null;
  engagementRate: number | null;
  errorMessage: string | null;
  archivedAt: string | null;
};

export type GenerateReportResult = {
  outcome: "created" | "duplicate" | "failed";
  message: string;
  versionId: string | null;
  versionNumber: number | null;
};

export type ReportGenerationActionState = {
  error?: string;
  success?: string;
  result?: GenerateReportResult;
};

/** Report identity available before a version row is allocated. */
export type ReportSnapshotContext = {
  reportId: string;
  reportNumber: string;
  sourceLastSyncedAt: string | null;
};

/** Version identity available only after the `generating` row is inserted. */
export type ReportVersionMetadata = {
  versionNumber: number;
  reportVersionId: string;
  generatedAt: string;
  generatedBy: string | null;
};

export type SerializeReportMetadata = ReportSnapshotContext &
  ReportVersionMetadata;

export type CampaignReportSeriesSummary = {
  hasSeries: boolean;
  reportId: string | null;
  reportNumber: string | null;
  latestVersion: ReportVersionSummary | null;
  versionCount: number;
  hasGenerating: boolean;
  hasFailed: boolean;
  liveFreshness: CampaignReportData["metadata"]["freshness"];
};

export type ComparisonMetricRow = {
  key: string;
  label: string;
  oldValue: number | null;
  newValue: number | null;
  absoluteDelta: number | null;
  percentDelta: number | null;
};

export type ReportVersionComparison = {
  fromVersion: ReportVersionSummary;
  toVersion: ReportVersionSummary;
  metrics: ComparisonMetricRow[];
};
