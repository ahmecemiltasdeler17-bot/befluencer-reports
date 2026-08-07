import {
  assertExportableVersion,
  buildPrintPayloadFromSnapshot,
} from "@/features/pdf/calculations";
import { EXPORT_TOKEN_TTL_SECONDS } from "@/features/pdf/constants";
import { ReportPdfError } from "@/features/pdf/errors";
import { isUuid } from "@/features/pdf/origin";
import {
  buildTokenExpiry,
  generateRawExportToken,
  hashExportToken,
} from "@/features/pdf/services/export-token";
import type {
  PrintReportPayload,
  ReportExportTokenIssue,
  ReportPdfExportTarget,
} from "@/features/pdf/types";
import { getCampaignById } from "@/features/campaigns/queries";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type ExportVersionRow = {
  id: string;
  campaign_id: string;
  report_id: string;
  version_number: number;
  status: string;
  generated_at: string | null;
  source_last_synced_at: string | null;
  snapshot: unknown;
};

const VERSION_COLUMNS =
  "id, campaign_id, report_id, version_number, status, generated_at, source_last_synced_at, snapshot";

/**
 * Resolves the export target for an authenticated user.
 * Confirms the version belongs to the campaign and is ready or archived.
 */
export async function getReportVersionForExport(
  campaignId: string,
  reportVersionId: string
): Promise<{ target: ReportPdfExportTarget; row: ExportVersionRow }> {
  if (!isUuid(campaignId) || !isUuid(reportVersionId)) {
    throw new ReportPdfError("report_not_found", "Invalid identifier format");
  }

  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new ReportPdfError("unauthorized", "Missing session");
  }

  const { data, error } = await supabase
    .from("report_versions")
    .select(VERSION_COLUMNS)
    .eq("id", reportVersionId)
    .maybeSingle();

  if (error) {
    throw new ReportPdfError("report_not_found", "Version lookup failed");
  }

  const row = (data as ExportVersionRow | null) ?? null;

  assertExportableVersion(row, campaignId);

  const typedRow = row as unknown as ExportVersionRow;
  const campaign = await getCampaignById(campaignId);

  return {
    row: typedRow,
    target: {
      campaignId,
      reportVersionId: typedRow.id,
      versionNumber: typedRow.version_number,
      status: typedRow.status as "ready" | "archived",
      campaignName: campaign?.name ?? "—",
      reportNumber: campaign?.report_number ?? null,
      generatedAt: typedRow.generated_at,
    },
  };
}

/**
 * Issues a single-use export token. Only the SHA-256 hash reaches the database;
 * the raw token is returned once and never logged.
 */
export async function createReportExportToken(
  reportVersionId: string
): Promise<ReportExportTokenIssue> {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new ReportPdfError("unauthorized", "Missing session");
  }

  const rawToken = generateRawExportToken();
  const now = new Date();
  const expiresAt = buildTokenExpiry(now, EXPORT_TOKEN_TTL_SECONDS);

  const { error } = await supabase.from("report_export_tokens").insert({
    report_version_id: reportVersionId,
    token_hash: hashExportToken(rawToken),
    created_by: auth.subject,
    expires_at: expiresAt,
  });

  if (error) {
    throw new ReportPdfError("export_token_failed", "Token insert failed");
  }

  return { token: rawToken, expiresAt };
}

/**
 * Claims a token and returns the snapshot-only print payload.
 *
 * Runs through a security definer function so the headless browser — which has
 * no session — can read exactly the one version it holds a valid token for.
 * Returns null for missing, expired, already-used or non-exportable versions.
 */
export async function consumeReportExportToken(
  rawToken: string
): Promise<PrintReportPayload | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("consume_report_export_token", {
    p_token_hash: hashExportToken(rawToken),
  });

  if (error) {
    return null;
  }

  const rows = (data ?? []) as {
    report_version_id: string;
    campaign_id: string;
    version_number: number;
    status: string;
    generated_at: string | null;
    source_last_synced_at: string | null;
    snapshot: unknown;
    campaign_name: string | null;
    report_number: string | null;
  }[];

  const row = rows[0];

  if (!row) {
    return null;
  }

  return buildPrintPayloadFromSnapshot({
    reportVersionId: row.report_version_id,
    campaignId: row.campaign_id,
    versionNumber: row.version_number,
    status: row.status,
    generatedAt: row.generated_at,
    sourceLastSyncedAt: row.source_last_synced_at,
    campaignName: row.campaign_name,
    reportNumber: row.report_number,
    snapshot: row.snapshot,
  });
}

/**
 * Session-based print payload for a human previewing the print layout.
 * Reads the stored snapshot only — never live campaign data.
 */
export async function getPrintPayloadForSession(
  campaignId: string,
  reportVersionId: string
): Promise<PrintReportPayload | null> {
  if (!isUuid(campaignId) || !isUuid(reportVersionId)) {
    return null;
  }

  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    return null;
  }

  const { data, error } = await supabase
    .from("report_versions")
    .select(VERSION_COLUMNS)
    .eq("id", reportVersionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as unknown as ExportVersionRow;

  if (row.campaign_id !== campaignId) {
    return null;
  }

  try {
    return buildPrintPayloadFromSnapshot({
      reportVersionId: row.id,
      campaignId: row.campaign_id,
      versionNumber: row.version_number,
      status: row.status,
      generatedAt: row.generated_at,
      sourceLastSyncedAt: row.source_last_synced_at,
      campaignName: null,
      reportNumber: null,
      snapshot: row.snapshot,
    });
  } catch {
    return null;
  }
}
