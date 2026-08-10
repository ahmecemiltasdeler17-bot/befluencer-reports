import type { ReportVersionStatus } from "@/features/report-generation/constants";
import type { CampaignReportData } from "@/features/reports/types";

/** Report version identity resolved by the authenticated PDF endpoint. */
export type ReportPdfExportTarget = {
  campaignId: string;
  reportVersionId: string;
  versionNumber: number;
  status: Extract<ReportVersionStatus, "ready" | "archived">;
  campaignName: string;
  reportNumber: string | null;
  generatedAt: string | null;
};

/** Raw token returned once at creation. Never persisted, never logged. */
export type ReportExportTokenIssue = {
  token: string;
  expiresAt: string;
};

/** Everything the print route renders, sourced only from the stored snapshot. */
export type PrintReportPayload = {
  reportVersionId: string;
  campaignId: string;
  versionNumber: number;
  status: Extract<ReportVersionStatus, "ready" | "archived">;
  generatedAt: string | null;
  sourceLastSyncedAt: string | null;
  campaignName: string;
  reportNumber: string;
  report: CampaignReportData;
};

export type GeneratedReportPdf = {
  /** Backed by a plain ArrayBuffer so it is usable directly as a response body. */
  bytes: Uint8Array<ArrayBuffer>;
  byteLength: number;
};

export type { ChromiumLaunchStrategy } from "@/lib/pdf/launch-browser";
