"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  buildCreatorImportPreviewRows,
  parseCreatorImportText,
} from "@/features/creator-import/parser";
import {
  findExistingTikTokCreators,
  insertCreatorImportBatch,
} from "@/features/creator-import/queries";
import {
  buildCreatorImportSyncRow,
  summarizeCreatorImportSyncRows,
} from "@/features/creator-import/sync-result";
import {
  CREATOR_IMPORT_BATCH_SIZE,
  type CreatorImportInsertResult,
  type CreatorImportPreview,
  type CreatorImportSyncResult,
  type CreatorImportSyncRow,
} from "@/features/creator-import/types";
import {
  BULK_CONCURRENCY,
  mapWithConcurrency,
} from "@/features/creator-sync/services/creator-sync-core";
import { syncTikTokCreator } from "@/features/creator-sync/services/sync-tiktok-creator";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    redirect("/login");
  }

  return supabase;
}

function sanitizeImportError(message: string, code?: string): string {
  if (code === "23505" || message.toLowerCase().includes("duplicate")) {
    return "Bazı creatorlar zaten kayıtlı; tekrarlar atlandı.";
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  if (normalized.includes("jwt")) {
    return "Oturumunuz geçersiz. Lütfen tekrar giriş yapın.";
  }

  return "İçe aktarma tamamlanamadı. Lütfen tekrar deneyin.";
}

export async function previewCreatorImportAction(
  text: string
): Promise<CreatorImportPreview> {
  await requireAuthenticatedClient();

  const parsed = parseCreatorImportText(text);

  if (parsed.error) {
    return {
      rows: [],
      totals: {
        total: 0,
        ready: 0,
        existing: 0,
        duplicateInList: 0,
        invalid: 0,
      },
      error: parsed.error,
    };
  }

  const usernames = parsed.candidates
    .filter((candidate) => candidate.ok)
    .map((candidate) => candidate.value.username);

  let existing: Awaited<ReturnType<typeof findExistingTikTokCreators>> = [];

  try {
    existing = await findExistingTikTokCreators(usernames);
  } catch (error) {
    return {
      rows: [],
      totals: {
        total: 0,
        ready: 0,
        existing: 0,
        duplicateInList: 0,
        invalid: 0,
      },
      error:
        error instanceof Error
          ? sanitizeImportError(error.message)
          : "Önizleme hazırlanamadı.",
    };
  }

  const existingUsernamesLower = new Set(
    existing.map((row) => row.username.trim().replace(/^@+/, "").toLowerCase())
  );

  for (const row of existing) {
    if (row.profile_url) {
      const match = row.profile_url.match(/tiktok\.com\/@([^/?#]+)/i);
      if (match?.[1]) {
        existingUsernamesLower.add(decodeURIComponent(match[1]).toLowerCase());
      }
    }
  }

  const { rows, totals } = buildCreatorImportPreviewRows(
    parsed,
    existingUsernamesLower
  );

  return { rows, totals };
}

export async function importCreatorsAction(
  text: string
): Promise<CreatorImportInsertResult> {
  await requireAuthenticatedClient();

  const preview = await previewCreatorImportAction(text);

  if (preview.error) {
    return {
      total: 0,
      inserted: 0,
      skippedExisting: 0,
      skippedDuplicate: 0,
      invalid: 0,
      failed: 0,
      insertedIds: [],
      error: preview.error,
    };
  }

  const readyRows = preview.rows.filter(
    (row) =>
      row.status === "ready" &&
      row.username &&
      row.displayName &&
      row.profileUrl
  );

  const skippedExisting = preview.totals.existing;
  const skippedDuplicate = preview.totals.duplicateInList;
  const invalid = preview.totals.invalid;

  if (readyRows.length === 0) {
    return {
      total: preview.totals.total,
      inserted: 0,
      skippedExisting,
      skippedDuplicate,
      invalid,
      failed: 0,
      insertedIds: [],
      message: "İçe aktarılacak yeni creator bulunamadı.",
    };
  }

  const insertedIds: string[] = [];
  let inserted = 0;
  let failed = 0;
  let racedExisting = 0;

  for (let i = 0; i < readyRows.length; i += CREATOR_IMPORT_BATCH_SIZE) {
    const batch = readyRows.slice(i, i + CREATOR_IMPORT_BATCH_SIZE).map((row) => ({
      username: row.username!,
      display_name: row.displayName!,
      profile_url: row.profileUrl!,
    }));

    const batchResult = await insertCreatorImportBatch(batch);

    if (!batchResult.error) {
      inserted += batchResult.inserted.length;
      insertedIds.push(...batchResult.inserted.map((row) => row.id));
      continue;
    }

    // Unique race or partial failure — fall back to row-by-row for this batch.
    for (const row of batch) {
      const single = await insertCreatorImportBatch([row]);

      if (!single.error && single.inserted.length > 0) {
        inserted += 1;
        insertedIds.push(single.inserted[0]!.id);
        continue;
      }

      if (single.code === "23505") {
        // Idempotent re-submit: treat as already present.
        racedExisting += 1;
        continue;
      }

      failed += 1;
    }
  }

  revalidatePath("/creators");
  revalidatePath("/creators/import");

  return {
    total: preview.totals.total,
    inserted,
    skippedExisting: skippedExisting + racedExisting,
    skippedDuplicate,
    invalid,
    failed,
    insertedIds,
    message:
      inserted > 0
        ? "Creatorlar eklendi. Gerçek ad, profil fotoğrafı ve takipçi bilgilerini almak için TikTok profillerini güncelleyin."
        : "Yeni creator eklenmedi.",
  };
}

/**
 * Syncs creator IDs (no campaign required). Concurrency 2; continues after
 * failures; never auto-runs without confirmation. Returns per-creator rows so
 * the UI can list failures and retry only those IDs.
 */
export async function syncImportedCreatorsAction(
  creatorIds: string[]
): Promise<CreatorImportSyncResult> {
  const supabase = await requireAuthenticatedClient();

  const uniqueIds = Array.from(
    new Set(creatorIds.filter((id) => UUID_PATTERN.test(id)))
  );

  if (uniqueIds.length === 0) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      rows: [],
      error: "Güncellenecek creator bulunamadı.",
    };
  }

  const metaById = new Map<
    string,
    { username: string; profileUrl: string | null }
  >();

  for (let i = 0; i < uniqueIds.length; i += 50) {
    const chunk = uniqueIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from("creators")
      .select("id, username, profile_url")
      .in("id", chunk);

    if (error) {
      return {
        total: uniqueIds.length,
        success: 0,
        failed: 0,
        skipped: 0,
        rows: [],
        error: sanitizeImportError(error.message, error.code),
      };
    }

    for (const row of data ?? []) {
      metaById.set(row.id as string, {
        username: (row.username as string) ?? "",
        profileUrl: (row.profile_url as string | null) ?? null,
      });
    }
  }

  const syncResults = await mapWithConcurrency(
    uniqueIds,
    BULK_CONCURRENCY,
    (creatorId) => syncTikTokCreator(creatorId)
  );

  const rows: CreatorImportSyncRow[] = uniqueIds.map((creatorId, index) => {
    const meta = metaById.get(creatorId);
    const sync = syncResults[index]!;
    return buildCreatorImportSyncRow({
      creatorId,
      username: meta?.username || creatorId.slice(0, 8),
      profileUrl: meta?.profileUrl ?? null,
      outcome: sync.outcome,
      message: sync.message,
    });
  });

  revalidatePath("/creators");

  return summarizeCreatorImportSyncRows(rows);
}
