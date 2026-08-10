import type {
  CreatorImportSyncErrorCode,
  CreatorImportSyncResult,
  CreatorImportSyncRow,
  CreatorImportSyncStatus,
} from "@/features/creator-import/types";

const ERROR_MESSAGES: Record<CreatorImportSyncErrorCode, string> = {
  creator_unavailable: "TikTok hesabı bulunamadı veya kullanılamıyor.",
  username_mismatch: "Sağlayıcı farklı bir kullanıcı döndürdü.",
  follower_unavailable: "Takipçi sayısı alınamadı.",
  upstream_temporary: "Geçici sağlayıcı hatası. Tekrar deneyin.",
  timeout: "İstek zaman aşımına uğradı.",
  not_configured: "TikTok senkronizasyonu yapılandırılmamış.",
  invalid_username: "Geçersiz TikTok kullanıcı adı.",
  unknown: "Profil güncellenemedi. Lütfen tekrar deneyin.",
};

/**
 * Maps a sync outcome message (already Turkish / sanitized upstream) onto a
 * stable public error code + copy. Never returns raw provider or SQL text.
 */
export function mapCreatorImportSyncError(message: string | null | undefined): {
  errorCode: CreatorImportSyncErrorCode;
  errorMessage: string;
} {
  const text = (message ?? "").trim();
  const normalized = text.toLowerCase();

  if (!text) {
    return {
      errorCode: "unknown",
      errorMessage: ERROR_MESSAGES.unknown,
    };
  }

  if (
    normalized.includes("zaman aşımı") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out")
  ) {
    return { errorCode: "timeout", errorMessage: ERROR_MESSAGES.timeout };
  }

  if (
    normalized.includes("farklı bir tiktok hesabı") ||
    normalized.includes("farklı bir kullanıcı") ||
    normalized.includes("username_mismatch")
  ) {
    return {
      errorCode: "username_mismatch",
      errorMessage: ERROR_MESSAGES.username_mismatch,
    };
  }

  if (
    normalized.includes("takipçi") &&
    (normalized.includes("alınamadı") ||
      normalized.includes("döndürmedi") ||
      normalized.includes("bulunamadı"))
  ) {
    return {
      errorCode: "follower_unavailable",
      errorMessage: ERROR_MESSAGES.follower_unavailable,
    };
  }

  if (
    normalized.includes("boş sonuç") ||
    normalized.includes("biçimi desteklenmiyor") ||
    normalized.includes("unsupported_result")
  ) {
    return {
      errorCode: "creator_unavailable",
      errorMessage: ERROR_MESSAGES.creator_unavailable,
    };
  }

  if (
    normalized.includes("profili bulunamadı") ||
    normalized.includes("gizli veya kullanılamıyor") ||
    normalized.includes("hesabı bulunamadı") ||
    normalized.includes("hesap erişilemiyor") ||
    normalized.includes("creator_not_found") ||
    normalized.includes("private_profile")
  ) {
    return {
      errorCode: "creator_unavailable",
      errorMessage: ERROR_MESSAGES.creator_unavailable,
    };
  }

  if (
    normalized.includes("yapılandırılmamış") ||
    normalized.includes("not_configured")
  ) {
    return {
      errorCode: "not_configured",
      errorMessage: ERROR_MESSAGES.not_configured,
    };
  }

  if (
    normalized.includes("geçersiz tiktok kullanıcı") ||
    normalized.includes("invalid_username")
  ) {
    return {
      errorCode: "invalid_username",
      errorMessage: ERROR_MESSAGES.invalid_username,
    };
  }

  if (
    normalized.includes("kullanım kotası") ||
    normalized.includes("payment_required") ||
    normalized.includes("apify hesab")
  ) {
    return {
      errorCode: "upstream_temporary",
      errorMessage:
        "Sağlayıcı kullanım kotası doldu. Apify hesabınızı kontrol edin.",
    };
  }

  if (
    normalized.includes("geçici") ||
    normalized.includes("rate") ||
    normalized.includes("limit") ||
    normalized.includes("sağlayıcı") ||
    normalized.includes("kimlik doğrulama") ||
    normalized.includes("upstream")
  ) {
    return {
      errorCode: "upstream_temporary",
      errorMessage: ERROR_MESSAGES.upstream_temporary,
    };
  }

  // Known safe Turkish messages may pass through only if they match our catalog.
  for (const [code, catalogMessage] of Object.entries(ERROR_MESSAGES) as Array<
    [CreatorImportSyncErrorCode, string]
  >) {
    if (text === catalogMessage) {
      return { errorCode: code, errorMessage: catalogMessage };
    }
  }

  return {
    errorCode: "unknown",
    errorMessage: ERROR_MESSAGES.unknown,
  };
}

export function buildCreatorImportSyncRow(input: {
  creatorId: string;
  username: string;
  profileUrl: string | null;
  outcome: CreatorImportSyncStatus;
  message?: string | null;
}): CreatorImportSyncRow {
  if (input.outcome === "success" || input.outcome === "skipped") {
    return {
      creatorId: input.creatorId,
      username: input.username,
      profileUrl: input.profileUrl,
      status: input.outcome,
      errorCode: null,
      errorMessage: null,
    };
  }

  const mapped = mapCreatorImportSyncError(input.message);
  return {
    creatorId: input.creatorId,
    username: input.username,
    profileUrl: input.profileUrl,
    status: "failed",
    errorCode: mapped.errorCode,
    errorMessage: mapped.errorMessage,
  };
}

export function summarizeCreatorImportSyncRows(
  rows: CreatorImportSyncRow[],
  options?: { error?: string }
): CreatorImportSyncResult {
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.status === "success") success += 1;
    else if (row.status === "failed") failed += 1;
    else skipped += 1;
  }

  return {
    total: rows.length,
    success,
    failed,
    skipped,
    rows,
    message: `${success} profil güncellendi${failed > 0 ? `, ${failed} başarısız` : ""}.`,
    error: options?.error,
  };
}

/**
 * Merges a retry result into a previous bulk sync result.
 * Successful/skipped rows from the previous run are preserved.
 * Only creator IDs present in `retry` are replaced.
 */
export function mergeCreatorImportSyncResults(
  previous: CreatorImportSyncResult,
  retry: CreatorImportSyncResult
): CreatorImportSyncResult {
  const retryById = new Map(retry.rows.map((row) => [row.creatorId, row]));

  const rows = previous.rows.map((row) => {
    const updated = retryById.get(row.creatorId);
    return updated ?? row;
  });

  return summarizeCreatorImportSyncRows(rows);
}

export function failedCreatorIdsFromSyncResult(
  result: CreatorImportSyncResult
): string[] {
  return result.rows
    .filter((row) => row.status === "failed")
    .map((row) => row.creatorId);
}
