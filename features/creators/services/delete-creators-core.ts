/**
 * Safe hard-delete for creators from the global pool.
 *
 * Relationship policy:
 * - videos.creator_id ON DELETE RESTRICT / NO ACTION → must block when videos exist
 * - campaign_creators CASCADE → assignments removed with creator
 * - creator_list_items CASCADE → list membership removed
 * - creator_metric_snapshots CASCADE → live growth history removed
 * - sync_jobs SET NULL → audit rows kept
 * - report_versions.snapshot JSONB → historical reports untouched (no FK)
 *
 * Preflight is fail-closed: a video-count query error refuses deletion.
 */

export const CREATOR_HAS_VIDEOS_DELETE_ERROR =
  "Bu içerik üreticisine bağlı videolar olduğu için silinemez.";

export type DeleteCreatorCandidate = {
  id: string;
  username: string;
  campaignCount: number;
  videoCount: number;
};

export type DeleteCreatorsPort = {
  isAuthenticated(): Promise<boolean>;
  loadCandidates(ids: string[]): Promise<DeleteCreatorCandidate[]>;
  deleteByIds(ids: string[]): Promise<void>;
};

export type DeleteCreatorsResult = {
  deleted: number;
  /** Creators refused because they still own videos. */
  blocked: number;
  /** Other failures (auth, not found, DB error). */
  failed: number;
  deletedIds: string[];
  blockedIds: string[];
  failedIds: string[];
  success?: string;
  error?: string;
};

export function buildSingleCreatorDeleteConfirmMessage(input: {
  username?: string | null;
  campaignCount?: number;
}): string {
  const handle = input.username?.trim()
    ? `@${input.username.trim().replace(/^@/, "")}`
    : "bu içerik üreticisini";

  const base = `Bu içerik üreticisini silmek istediğinize emin misiniz?\n\n${handle} kalıcı olarak global havuzdan kaldırılacak.`;

  const campaigns = input.campaignCount ?? 0;
  if (campaigns > 0) {
    return `${base}\n\nUyarı: ${campaigns} kampanyaya atanmış. Atama kayıtları da kaldırılacak.\nKaydedilmiş geçmiş raporlar etkilenmez.`;
  }

  return `${base}\nKaydedilmiş geçmiş raporlar etkilenmez.`;
}

export function buildBulkCreatorDeleteConfirmMessage(input: {
  count: number;
  assignedCount: number;
}): string {
  const base = `${input.count} içerik üreticisini silmek istediğinize emin misiniz?\n\nSeçilen kayıtlar kalıcı olarak global havuzdan kaldırılacak.`;

  if (input.assignedCount > 0) {
    return `${base}\n\nUyarı: ${input.assignedCount} tanesi bir veya daha fazla kampanyaya atanmış. Atama kayıtları da kaldırılacak.\nKaydedilmiş geçmiş raporlar etkilenmez.`;
  }

  return `${base}\nKaydedilmiş geçmiş raporlar etkilenmez.`;
}

export function classifyCreatorsForDeletion(candidates: DeleteCreatorCandidate[]): {
  deletable: DeleteCreatorCandidate[];
  blocked: DeleteCreatorCandidate[];
} {
  const deletable: DeleteCreatorCandidate[] = [];
  const blocked: DeleteCreatorCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.videoCount > 0) {
      blocked.push(candidate);
    } else {
      deletable.push(candidate);
    }
  }

  return { deletable, blocked };
}

/**
 * Aggregate video rows into per-creator counts.
 * Used by the Supabase port and unit-tested so counting cannot silently go to zero.
 */
export function countVideosByCreatorId(
  videoRows: Array<{ creator_id: string | null | undefined }>,
  creatorIds: string[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of creatorIds) {
    counts.set(id, 0);
  }
  for (const row of videoRows) {
    const id = row.creator_id;
    if (!id || !counts.has(id)) {
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function formatBlockedCreatorsError(
  blocked: DeleteCreatorCandidate[]
): string {
  if (blocked.length === 0) {
    return CREATOR_HAS_VIDEOS_DELETE_ERROR;
  }
  if (blocked.length === 1) {
    return CREATOR_HAS_VIDEOS_DELETE_ERROR;
  }

  const sample = blocked
    .slice(0, 3)
    .map((row) => `@${row.username}`)
    .join(", ");
  const more = blocked.length > 3 ? ` ve ${blocked.length - 3} diğer` : "";
  return `${blocked.length} içerik üreticisi bağlı videolar nedeniyle silinemedi: ${sample}${more}.`;
}

export function formatDeleteCreatorsSummary(input: {
  deleted: number;
  blocked: number;
  failed: number;
}): string {
  const parts = [`${input.deleted} silindi`];
  if (input.blocked > 0) {
    parts.push(`${input.blocked} engellendi (bağlı video)`);
  }
  if (input.failed > 0) {
    parts.push(`${input.failed} başarısız`);
  }
  return parts.join(" · ");
}

export function isForeignKeyViolationMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("23503") ||
    normalized.includes("foreign key") ||
    normalized.includes("violates foreign key constraint") ||
    normalized.includes("videos_creator_id_fkey")
  );
}

export async function runDeleteCreators(
  creatorIds: string[],
  port: DeleteCreatorsPort
): Promise<DeleteCreatorsResult> {
  if (!(await port.isAuthenticated())) {
    return {
      deleted: 0,
      blocked: 0,
      failed: creatorIds.length,
      deletedIds: [],
      blockedIds: [],
      failedIds: [...creatorIds],
      error: "Bu işlem için yetkiniz yok.",
    };
  }

  const uniqueIds = [...new Set(creatorIds.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length === 0) {
    return {
      deleted: 0,
      blocked: 0,
      failed: 0,
      deletedIds: [],
      blockedIds: [],
      failedIds: [],
      error: "Silinecek içerik üreticisi seçilmedi.",
    };
  }

  let candidates: DeleteCreatorCandidate[];
  try {
    candidates = await port.loadCandidates(uniqueIds);
  } catch (error) {
    return {
      deleted: 0,
      blocked: 0,
      failed: uniqueIds.length,
      deletedIds: [],
      blockedIds: [],
      failedIds: uniqueIds,
      error:
        error instanceof Error
          ? error.message
          : "Video bağlantıları doğrulanamadı. Silme iptal edildi.",
    };
  }

  if (candidates.length === 0) {
    return {
      deleted: 0,
      blocked: 0,
      failed: uniqueIds.length,
      deletedIds: [],
      blockedIds: [],
      failedIds: uniqueIds,
      error: "Silinecek içerik üreticisi bulunamadı.",
    };
  }

  const { deletable, blocked } = classifyCreatorsForDeletion(candidates);
  const blockedIds = blocked.map((row) => row.id);

  if (deletable.length === 0) {
    return {
      deleted: 0,
      blocked: blocked.length,
      failed: 0,
      deletedIds: [],
      blockedIds,
      failedIds: [],
      error: formatBlockedCreatorsError(blocked),
    };
  }

  const deletableIds = deletable.map((row) => row.id);

  try {
    await port.deleteByIds(deletableIds);
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : "Silme işlemi tamamlanamadı. Lütfen tekrar deneyin.";
    const message = isForeignKeyViolationMessage(raw)
      ? CREATOR_HAS_VIDEOS_DELETE_ERROR
      : raw;

    return {
      deleted: 0,
      blocked: blocked.length,
      failed: deletableIds.length,
      deletedIds: [],
      blockedIds,
      failedIds: deletableIds,
      error: message,
    };
  }

  const summary = formatDeleteCreatorsSummary({
    deleted: deletableIds.length,
    blocked: blocked.length,
    failed: 0,
  });

  return {
    deleted: deletableIds.length,
    blocked: blocked.length,
    failed: 0,
    deletedIds: deletableIds,
    blockedIds,
    failedIds: [],
    success: summary,
    error:
      blocked.length > 0 ? formatBlockedCreatorsError(blocked) : undefined,
  };
}
