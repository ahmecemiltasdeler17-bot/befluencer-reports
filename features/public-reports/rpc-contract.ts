import type { PublicReportSharePayload } from "@/features/public-reports/types";

/** Must match SQL parameter name on resolve/consume RPCs. */
export const RESOLVE_PUBLIC_SHARE_RPC = "resolve_public_report_share";
export const RESOLVE_PUBLIC_SHARE_RPC_PARAM = "p_raw_token";

/** Exact keys returned by resolve_public_report_share RETURNS TABLE. */
export const RESOLVE_PUBLIC_SHARE_RPC_KEYS = [
  "share_id",
  "report_version_id",
  "campaign_id",
  "version_number",
  "status",
  "generated_at",
  "snapshot",
  "campaign_name",
  "report_number",
  "allow_pdf_download",
  "expires_at",
  "label",
] as const;

export type RpcShareRow = {
  share_id: string;
  report_version_id: string;
  campaign_id: string;
  version_number: number;
  status: string;
  generated_at: string | null;
  snapshot: unknown;
  campaign_name: string | null;
  report_number: string | null;
  allow_pdf_download: boolean;
  expires_at?: string | null;
  label?: string | null;
  access_recorded?: boolean;
};

export function mapRpcPayload(row: RpcShareRow): PublicReportSharePayload | null {
  if (row.status !== "ready" && row.status !== "archived") {
    return null;
  }

  if (row.snapshot == null) {
    return null;
  }

  return {
    shareId: row.share_id,
    reportVersionId: row.report_version_id,
    campaignId: row.campaign_id,
    versionNumber: row.version_number,
    status: row.status,
    generatedAt: row.generated_at,
    snapshot: row.snapshot,
    campaignName: row.campaign_name ?? "—",
    reportNumber: row.report_number,
    allowPdfDownload: row.allow_pdf_download,
    expiresAt: row.expires_at ?? null,
    label: row.label ?? null,
    accessRecorded: row.access_recorded,
  };
}

export function firstRpcRow(data: unknown): RpcShareRow | null {
  if (Array.isArray(data)) {
    return (data[0] as RpcShareRow | undefined) ?? null;
  }

  if (data && typeof data === "object") {
    return data as RpcShareRow;
  }

  return null;
}
