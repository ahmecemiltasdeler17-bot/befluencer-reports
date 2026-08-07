import "server-only";

import {
  isShareableVersionStatus,
  mapShareRow,
} from "@/features/public-reports/calculations";
import {
  diagnoseTokenFormat,
  logPublicShareResolveDiagnostic,
} from "@/features/public-reports/diagnostics";
import { PublicReportShareError } from "@/features/public-reports/errors";
import {
  RESOLVE_PUBLIC_SHARE_RPC,
  RESOLVE_PUBLIC_SHARE_RPC_PARAM,
  firstRpcRow,
  mapRpcPayload,
} from "@/features/public-reports/rpc-contract";
import {
  hashShareToken,
  isAccessNonce,
  isRawShareToken,
} from "@/features/public-reports/token";
import type {
  PublicReportSharePayload,
  PublicReportShareRow,
  PublicReportShareSummary,
} from "@/features/public-reports/types";
import { isUuid } from "@/features/pdf/origin";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export {
  RESOLVE_PUBLIC_SHARE_RPC,
  RESOLVE_PUBLIC_SHARE_RPC_KEYS,
  RESOLVE_PUBLIC_SHARE_RPC_PARAM,
  mapRpcPayload,
} from "@/features/public-reports/rpc-contract";

const SHARE_COLUMNS =
  "id, report_version_id, created_by, created_at, expires_at, revoked_at, last_accessed_at, access_count, label, allow_pdf_download";

/**
 * SSR-safe load: validates token and returns immutable snapshot without
 * incrementing access_count. Safe for page render; do not call from metadata
 * with side effects either — prefer static metadata.
 */
export async function resolvePublicReportShare(
  rawToken: string
): Promise<PublicReportSharePayload | null> {
  const tokenFormatValid = diagnoseTokenFormat(rawToken);

  if (!tokenFormatValid) {
    logPublicShareResolveDiagnostic({
      tokenFormatValid: false,
      shareRowFound: false,
      shareUsable: false,
      reportVersionStatus: null,
      rpcErrorCode: "invalid_token_format",
    });
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(RESOLVE_PUBLIC_SHARE_RPC, {
    [RESOLVE_PUBLIC_SHARE_RPC_PARAM]: rawToken,
  });

  if (error) {
    logPublicShareResolveDiagnostic({
      tokenFormatValid: true,
      shareRowFound: false,
      shareUsable: false,
      reportVersionStatus: null,
      rpcErrorCode: error.code ?? "rpc_error",
    });
    return null;
  }

  const row = firstRpcRow(data);

  if (!row) {
    logPublicShareResolveDiagnostic({
      tokenFormatValid: true,
      shareRowFound: false,
      shareUsable: false,
      reportVersionStatus: null,
      rpcErrorCode: null,
    });
    return null;
  }

  const payload = mapRpcPayload(row);

  logPublicShareResolveDiagnostic({
    tokenFormatValid: true,
    shareRowFound: true,
    shareUsable: payload !== null,
    reportVersionStatus: row.status ?? null,
    rpcErrorCode: null,
  });

  return payload;
}

/**
 * Records one page access when a fresh nonce is supplied. Idempotent for the
 * same (share, nonce) pair. Returns null for invalid/revoked/expired tokens.
 */
export async function consumePublicReportShareAccess(
  rawToken: string,
  accessNonce: string
): Promise<PublicReportSharePayload | null> {
  if (!isRawShareToken(rawToken) || !isAccessNonce(accessNonce)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_public_report_share", {
    [RESOLVE_PUBLIC_SHARE_RPC_PARAM]: rawToken,
    p_access_nonce: accessNonce,
  });

  if (error) {
    return null;
  }

  const row = firstRpcRow(data);
  return row ? mapRpcPayload(row) : null;
}

/**
 * PDF path: increments access once and requires allow_pdf_download.
 */
export async function consumePublicReportPdfShare(
  rawToken: string
): Promise<PublicReportSharePayload | null> {
  if (!isRawShareToken(rawToken)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_public_report_pdf_share", {
    [RESOLVE_PUBLIC_SHARE_RPC_PARAM]: rawToken,
  });

  if (error) {
    return null;
  }

  const row = firstRpcRow(data);
  return row ? mapRpcPayload(row) : null;
}

/**
 * Issues a short-lived print token for the existing authenticated print route.
 * Passes only the SHA-256 of the share token — never the raw share token.
 */
export async function issuePublicReportPrintToken(
  rawShareToken: string,
  exportTokenHash: string,
  expiresAt: string
): Promise<string | null> {
  if (!isRawShareToken(rawShareToken)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_public_report_print_token", {
    p_share_token_hash: hashShareToken(rawShareToken),
    p_export_token_hash: exportTokenHash,
    p_expires_at: expiresAt,
  });

  if (error || !data) {
    return null;
  }

  return typeof data === "string" ? data : null;
}

export async function listPublicReportShares(
  reportVersionId: string
): Promise<PublicReportShareSummary[]> {
  if (!isUuid(reportVersionId)) {
    throw new PublicReportShareError("validation_failed", "Invalid version id");
  }

  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new PublicReportShareError("unauthorized");
  }

  const { data, error } = await supabase
    .from("public_report_shares")
    .select(SHARE_COLUMNS)
    .eq("report_version_id", reportVersionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new PublicReportShareError("database_failure", "list failed");
  }

  return ((data ?? []) as PublicReportShareRow[]).map((row) => mapShareRow(row));
}

export async function getPublicReportShare(
  shareId: string
): Promise<PublicReportShareSummary | null> {
  if (!isUuid(shareId)) {
    return null;
  }

  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new PublicReportShareError("unauthorized");
  }

  const { data, error } = await supabase
    .from("public_report_shares")
    .select(SHARE_COLUMNS)
    .eq("id", shareId)
    .maybeSingle();

  if (error) {
    throw new PublicReportShareError("database_failure", "get failed");
  }

  if (!data) {
    return null;
  }

  return mapShareRow(data as PublicReportShareRow);
}

export async function assertShareableReportVersion(
  reportVersionId: string
): Promise<{
  id: string;
  campaignId: string;
  status: string;
  versionNumber: number;
}> {
  if (!isUuid(reportVersionId)) {
    throw new PublicReportShareError("validation_failed", "Invalid version id");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_versions")
    .select("id, campaign_id, status, version_number")
    .eq("id", reportVersionId)
    .maybeSingle();

  if (error || !data) {
    throw new PublicReportShareError("report_unavailable", "Version not found");
  }

  const row = data as {
    id: string;
    campaign_id: string;
    status: string;
    version_number: number;
  };

  if (!isShareableVersionStatus(row.status)) {
    throw new PublicReportShareError("report_unavailable", row.status);
  }

  return {
    id: row.id,
    campaignId: row.campaign_id,
    status: row.status,
    versionNumber: row.version_number,
  };
}
