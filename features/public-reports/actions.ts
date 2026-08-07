"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  assertExpiryWithinLimit,
  resolveShareExpiresAt,
  sanitizeShareLabel,
} from "@/features/public-reports/calculations";
import {
  PublicReportShareError,
  toManagementShareMessage,
} from "@/features/public-reports/errors";
import {
  assertShareableReportVersion,
  getPublicReportShare,
  listPublicReportShares,
} from "@/features/public-reports/queries";
import {
  buildPublicShareUrl,
  generateRawShareToken,
  hashShareToken,
} from "@/features/public-reports/token";
import type {
  CreatePublicReportShareInput,
  PublicShareActionState,
  ShareExpirationPreset,
  UpdatePublicReportShareInput,
} from "@/features/public-reports/types";
import { getReportVersionById } from "@/features/report-generation/queries";
import { isUuid } from "@/features/pdf/origin";
import { getPublicReportOrigin } from "@/lib/origins";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const EXPIRATION_PRESETS = new Set<ShareExpirationPreset>([
  "never",
  "24h",
  "7d",
  "30d",
  "custom",
]);

async function requireAuth() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    redirect("/login");
  }

  return { supabase, auth };
}

function revalidateSharePaths(campaignId: string, versionId: string) {
  revalidatePath("/");
  revalidatePath(`/campaigns/${campaignId}/reports`);
  revalidatePath(`/campaigns/${campaignId}/reports/${versionId}`);
}

export async function createPublicReportShareAction(
  input: CreatePublicReportShareInput
): Promise<PublicShareActionState> {
  try {
    const { supabase, auth } = await requireAuth();

    if (!isUuid(input.reportVersionId)) {
      throw new PublicReportShareError("validation_failed", "Invalid version id");
    }

    if (!EXPIRATION_PRESETS.has(input.expiration)) {
      throw new PublicReportShareError("validation_failed", "Invalid expiration");
    }

    const version = await assertShareableReportVersion(input.reportVersionId);
    const now = new Date();

    let expiresAt: string | null;

    try {
      expiresAt = resolveShareExpiresAt(
        input.expiration,
        now,
        input.customExpiresAt
      );
    } catch (cause) {
      const code =
        cause instanceof Error ? cause.message : "validation_failed";

      if (code === "expiry_not_future") {
        throw new PublicReportShareError(
          "validation_failed",
          "Expiry must be in the future"
        );
      }

      if (code === "expiry_too_far") {
        throw new PublicReportShareError(
          "validation_failed",
          "Expiry cannot exceed 1 year"
        );
      }

      throw new PublicReportShareError("validation_failed", code);
    }

    let publicReportOrigin: string;

    try {
      // Absolute share links use PUBLIC_REPORT_URL (falls back to APP_URL).
      // Never built from Host / X-Forwarded-Host.
      publicReportOrigin = getPublicReportOrigin();
    } catch {
      throw new PublicReportShareError("app_origin_invalid");
    }

    const rawToken = generateRawShareToken();
    const tokenHash = hashShareToken(rawToken);
    const label = sanitizeShareLabel(input.label);

    const { data, error } = await supabase
      .from("public_report_shares")
      .insert({
        report_version_id: version.id,
        token_hash: tokenHash,
        created_by: auth.subject,
        expires_at: expiresAt,
        label,
        allow_pdf_download: Boolean(input.allowPdfDownload),
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new PublicReportShareError("database_failure", "insert failed");
    }

    const publicUrl = buildPublicShareUrl(publicReportOrigin, rawToken);

    revalidateSharePaths(version.campaignId, version.id);

    return {
      success: "Paylaşım bağlantısı oluşturuldu.",
      result: {
        shareId: data.id as string,
        publicUrl,
        expiresAt,
        allowPdfDownload: Boolean(input.allowPdfDownload),
      },
    };
  } catch (error) {
    if (error instanceof PublicReportShareError) {
      return { error: toManagementShareMessage(error) };
    }

    // redirect() throws; rethrow
    throw error;
  }
}

export async function revokePublicReportShareAction(
  shareId: string
): Promise<PublicShareActionState> {
  try {
    const { supabase } = await requireAuth();

    if (!isUuid(shareId)) {
      throw new PublicReportShareError("validation_failed");
    }

    const existing = await getPublicReportShare(shareId);

    if (!existing) {
      throw new PublicReportShareError("share_not_found");
    }

    if (existing.status === "revoked") {
      return { success: "Paylaşım zaten iptal edilmiş." };
    }

    const { error } = await supabase
      .from("public_report_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", shareId)
      .is("revoked_at", null);

    if (error) {
      throw new PublicReportShareError("database_failure", "revoke failed");
    }

    const version = await getReportVersionById(existing.reportVersionId);

    if (version) {
      revalidateSharePaths(version.campaign_id, version.id);
    }

    return { success: "Paylaşım bağlantısı iptal edildi." };
  } catch (error) {
    if (error instanceof PublicReportShareError) {
      return { error: toManagementShareMessage(error) };
    }

    throw error;
  }
}

export async function updatePublicReportShareAction(
  input: UpdatePublicReportShareInput
): Promise<PublicShareActionState> {
  try {
    const { supabase } = await requireAuth();

    if (!isUuid(input.shareId)) {
      throw new PublicReportShareError("validation_failed");
    }

    const existing = await getPublicReportShare(input.shareId);

    if (!existing) {
      throw new PublicReportShareError("share_not_found");
    }

    if (existing.status === "revoked") {
      throw new PublicReportShareError(
        "share_revoked",
        "Cannot update a revoked share"
      );
    }

    const patch: {
      label?: string | null;
      expires_at?: string | null;
      allow_pdf_download?: boolean;
    } = {};

    if (input.label !== undefined) {
      patch.label = sanitizeShareLabel(input.label);
    }

    if (input.expiresAt !== undefined) {
      const now = new Date();
      assertExpiryWithinLimit(
        input.expiresAt,
        now,
        new Date(existing.createdAt)
      );
      patch.expires_at = input.expiresAt;
    }

    if (input.allowPdfDownload !== undefined) {
      patch.allow_pdf_download = Boolean(input.allowPdfDownload);
    }

    if (Object.keys(patch).length === 0) {
      return { success: "Değişiklik yok." };
    }

    const { error } = await supabase
      .from("public_report_shares")
      .update(patch)
      .eq("id", input.shareId)
      .is("revoked_at", null);

    if (error) {
      throw new PublicReportShareError("database_failure", "update failed");
    }

    const version = await getReportVersionById(existing.reportVersionId);

    if (version) {
      revalidateSharePaths(version.campaign_id, version.id);
    }

    return { success: "Paylaşım güncellendi." };
  } catch (error) {
    if (error instanceof Error && error.message === "expiry_not_future") {
      return { error: "Bitiş tarihi gelecekte olmalıdır." };
    }

    if (error instanceof Error && error.message === "expiry_too_far") {
      return { error: "Bitiş tarihi en fazla 1 yıl olabilir." };
    }

    if (error instanceof PublicReportShareError) {
      return { error: toManagementShareMessage(error) };
    }

    throw error;
  }
}

/** Authenticated list helper for server components. */
export async function listPublicReportSharesAction(
  reportVersionId: string
) {
  return listPublicReportShares(reportVersionId);
}
