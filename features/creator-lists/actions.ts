"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeSelectedCreatorIds } from "@/features/creator-lists/calculations";
import {
  logCreatorListDiagnostics,
  mapCreatorListSupabaseError,
  readSupabaseErrorParts,
  type CreatorListOperation,
} from "@/features/creator-lists/diagnostics";
import {
  CreatorListError,
  type CreatorListErrorCode,
  toCreatorListUserMessage,
} from "@/features/creator-lists/errors";
import { getCreatorList, getCreatorListShare } from "@/features/creator-lists/queries";
import {
  addCreatorsSchema,
  createCreatorListSchema,
  itemNotesSchema,
  reorderSchema,
  updateCreatorListSchema,
} from "@/features/creator-lists/schemas";
import {
  generateRawShareToken,
  hashShareToken,
} from "@/features/creator-lists/token";
import type {
  CampaignHandoffSummary,
  CreateCreatorListShareInput,
  CreatorListActionState,
  UpdateCreatorListInput,
} from "@/features/creator-lists/types";
import { CREATOR_SELECTION_MAX } from "@/features/creator-lists/types";
import {
  assertExpiryWithinLimit,
  resolveShareExpiresAt,
  sanitizeShareLabel,
} from "@/features/public-reports/calculations";
import type { ShareExpirationPreset } from "@/features/public-reports/types";
import { isUuid } from "@/features/pdf/origin";
import { getPublicReportOrigin, getPublicReportUrl } from "@/lib/origins";
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

function revalidateListPaths(listId?: string) {
  revalidatePath("/creators");
  revalidatePath("/creator-lists");
  if (listId) {
    revalidatePath(`/creator-lists/${listId}`);
  }
}

function throwMappedSupabaseError(
  error: unknown,
  input: {
    operation: CreatorListOperation;
    tableOrRpc: string;
    authenticated: boolean;
    fallback: CreatorListErrorCode;
    insertedItemCount?: number;
  }
): never {
  const parts = readSupabaseErrorParts(error);
  const mapped = mapCreatorListSupabaseError(error, input.fallback);

  logCreatorListDiagnostics({
    operation: input.operation,
    tableOrRpc: input.tableOrRpc,
    errorCode: parts.code,
    constraint: parts.constraint,
    authenticated: input.authenticated,
    insertedItemCount: input.insertedItemCount,
    mappedCode: mapped,
  });

  throw new CreatorListError(mapped);
}

export async function createCreatorListAction(input: {
  name: string;
  description?: string | null;
  internalNotes?: string | null;
  creatorIds: string[];
}): Promise<CreatorListActionState> {
  try {
    const { supabase, auth } = await requireAuth();
    const parsed = createCreatorListSchema.safeParse({
      ...input,
      creatorIds: normalizeSelectedCreatorIds(input.creatorIds),
    });

    if (!parsed.success) {
      throw new CreatorListError("validation_failed");
    }

    const creatorIds = parsed.data.creatorIds;

    if (creatorIds.length > CREATOR_SELECTION_MAX) {
      throw new CreatorListError("selection_limit");
    }

    const { data: existingCreators, error: creatorsError } = await supabase
      .from("creators")
      .select("id")
      .in("id", creatorIds);

    if (creatorsError) {
      throwMappedSupabaseError(creatorsError, {
        operation: "createCreatorList",
        tableOrRpc: "creators",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    const validIds = new Set(
      (existingCreators ?? []).map((row) => row.id as string)
    );
    // Deduplicated + validated UUIDs only.
    const filtered = [...new Set(creatorIds)].filter((id) => validIds.has(id));

    if (filtered.length === 0) {
      throw new CreatorListError("invalid_creator_ids");
    }

    const { data: list, error } = await supabase
      .from("creator_lists")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        internal_notes: parsed.data.internalNotes ?? null,
        status: "draft",
        created_by: auth.subject,
      })
      .select("id")
      .single();

    if (error || !list?.id) {
      throwMappedSupabaseError(error ?? { code: "PGRST116", message: "no list id" }, {
        operation: "createCreatorList",
        tableOrRpc: "creator_lists",
        authenticated: true,
        fallback: "list_insert_failure",
      });
    }

    const listId = list.id as string;

    const rows = filtered.map((creatorId, index) => ({
      creator_list_id: listId,
      creator_id: creatorId,
      position: index,
    }));

    const { error: itemsError } = await supabase
      .from("creator_list_items")
      .insert(rows);

    if (itemsError) {
      const parts = readSupabaseErrorParts(itemsError);
      const mapped = mapCreatorListSupabaseError(
        itemsError,
        "item_insert_failure"
      );

      logCreatorListDiagnostics({
        operation: "insertCreatorListItems",
        tableOrRpc: "creator_list_items",
        errorCode: parts.code,
        constraint: parts.constraint,
        authenticated: true,
        insertedItemCount: 0,
        mappedCode: mapped,
      });

      // Clean up the empty list so the user can retry safely.
      await supabase.from("creator_lists").delete().eq("id", listId);

      throw new CreatorListError(
        mapped === "item_insert_failure" || mapped === "database_failure"
          ? "partial_create_failure"
          : mapped
      );
    }

    logCreatorListDiagnostics({
      operation: "createCreatorList",
      tableOrRpc: "creator_lists+creator_list_items",
      authenticated: true,
      insertedItemCount: rows.length,
    });

    revalidateListPaths(listId);
    redirect(`/creator-lists/${listId}`);
  } catch (error) {
    if (error instanceof CreatorListError) {
      return { error: error.toUserMessage() };
    }
    throw error;
  }
}

export async function updateCreatorListAction(
  input: UpdateCreatorListInput
): Promise<CreatorListActionState> {
  try {
    const { supabase } = await requireAuth();
    const parsed = updateCreatorListSchema.safeParse(input);

    if (!parsed.success) {
      throw new CreatorListError("validation_failed");
    }

    const existing = await getCreatorList(parsed.data.listId);
    if (!existing) {
      throw new CreatorListError("list_not_found");
    }

    const { error } = await supabase
      .from("creator_lists")
      .update({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        internal_notes: parsed.data.internalNotes ?? null,
        status: parsed.data.status ?? existing.status,
      })
      .eq("id", parsed.data.listId);

    if (error) {
      throwMappedSupabaseError(error, {
        operation: "updateCreatorList",
        tableOrRpc: "creator_lists",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    revalidateListPaths(parsed.data.listId);
    return { success: "Liste güncellendi." };
  } catch (error) {
    return { error: toCreatorListUserMessage(error) };
  }
}

export async function archiveCreatorListAction(
  listId: string
): Promise<CreatorListActionState> {
  try {
    const { supabase } = await requireAuth();
    if (!isUuid(listId)) {
      throw new CreatorListError("list_not_found");
    }

    const { error } = await supabase
      .from("creator_lists")
      .update({ status: "archived" })
      .eq("id", listId);

    if (error) {
      throwMappedSupabaseError(error, {
        operation: "archiveCreatorList",
        tableOrRpc: "creator_lists",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    revalidateListPaths(listId);
    return { success: "Liste arşivlendi." };
  } catch (error) {
    return { error: toCreatorListUserMessage(error) };
  }
}

export async function deleteCreatorListAction(
  listId: string
): Promise<CreatorListActionState> {
  try {
    const { supabase } = await requireAuth();
    if (!isUuid(listId)) {
      throw new CreatorListError("list_not_found");
    }

    const list = await getCreatorList(listId);
    if (!list) {
      throw new CreatorListError("list_not_found");
    }

    if (list.active_share_count > 0) {
      return {
        error:
          "Aktif paylaşımı olan listeler silinemez. Önce paylaşımları iptal edin veya listeyi arşivleyin.",
      };
    }

    const { error } = await supabase
      .from("creator_lists")
      .delete()
      .eq("id", listId);

    if (error) {
      throwMappedSupabaseError(error, {
        operation: "deleteCreatorList",
        tableOrRpc: "creator_lists",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    revalidateListPaths();
    return { success: "Liste silindi." };
  } catch (error) {
    return { error: toCreatorListUserMessage(error) };
  }
}

export async function addCreatorsToListAction(input: {
  listId: string;
  creatorIds: string[];
}): Promise<CreatorListActionState> {
  try {
    const { supabase } = await requireAuth();
    const parsed = addCreatorsSchema.safeParse({
      listId: input.listId,
      creatorIds: normalizeSelectedCreatorIds(input.creatorIds),
    });

    if (!parsed.success) {
      throw new CreatorListError("validation_failed");
    }

    const list = await getCreatorList(parsed.data.listId);
    if (!list) {
      throw new CreatorListError("list_not_found");
    }

    const existing = new Set(list.items.map((item) => item.creator_id));
    const toAdd = parsed.data.creatorIds.filter((id) => !existing.has(id));

    if (toAdd.length === 0) {
      return { success: "Seçilen creatorlar zaten listede." };
    }

    if (existing.size + toAdd.length > CREATOR_SELECTION_MAX) {
      throw new CreatorListError("selection_limit");
    }

    const start = list.items.reduce(
      (max, item) => Math.max(max, item.position),
      -1
    );

    const rows = toAdd.map((creatorId, index) => ({
      creator_list_id: parsed.data.listId,
      creator_id: creatorId,
      position: start + 1 + index,
    }));

    const { error } = await supabase.from("creator_list_items").insert(rows);

    if (error) {
      throwMappedSupabaseError(error, {
        operation: "addCreatorsToList",
        tableOrRpc: "creator_list_items",
        authenticated: true,
        fallback: "item_insert_failure",
        insertedItemCount: 0,
      });
    }

    logCreatorListDiagnostics({
      operation: "addCreatorsToList",
      tableOrRpc: "creator_list_items",
      authenticated: true,
      insertedItemCount: rows.length,
    });

    revalidateListPaths(parsed.data.listId);
    return {
      success: `${toAdd.length} creator listeye eklendi.`,
      listId: parsed.data.listId,
    };
  } catch (error) {
    return { error: toCreatorListUserMessage(error) };
  }
}

export async function removeCreatorFromListAction(
  listId: string,
  itemId: string
): Promise<CreatorListActionState> {
  try {
    const { supabase } = await requireAuth();
    if (!isUuid(listId) || !isUuid(itemId)) {
      throw new CreatorListError("validation_failed");
    }

    const { error } = await supabase
      .from("creator_list_items")
      .delete()
      .eq("id", itemId)
      .eq("creator_list_id", listId);

    if (error) {
      throwMappedSupabaseError(error, {
        operation: "removeCreatorFromList",
        tableOrRpc: "creator_list_items",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    revalidateListPaths(listId);
    return { success: "Creator listeden çıkarıldı." };
  } catch (error) {
    return { error: toCreatorListUserMessage(error) };
  }
}

export async function reorderCreatorListItemsAction(input: {
  listId: string;
  orderedItemIds: string[];
}): Promise<CreatorListActionState> {
  try {
    const { supabase } = await requireAuth();
    const parsed = reorderSchema.safeParse(input);

    if (!parsed.success) {
      throw new CreatorListError("validation_failed");
    }

    const updates = parsed.data.orderedItemIds.map((itemId, index) =>
      supabase
        .from("creator_list_items")
        .update({ position: index })
        .eq("id", itemId)
        .eq("creator_list_id", parsed.data.listId)
    );

    const results = await Promise.all(updates);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) {
      throwMappedSupabaseError(firstError, {
        operation: "reorderCreatorListItems",
        tableOrRpc: "creator_list_items",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    revalidateListPaths(parsed.data.listId);
    return { success: "Sıralama güncellendi." };
  } catch (error) {
    return { error: toCreatorListUserMessage(error) };
  }
}

export async function updateCreatorListItemNotesAction(input: {
  itemId: string;
  publicNote?: string | null;
  internalNote?: string | null;
}): Promise<CreatorListActionState> {
  try {
    const { supabase } = await requireAuth();
    const parsed = itemNotesSchema.safeParse(input);

    if (!parsed.success) {
      throw new CreatorListError("validation_failed");
    }

    const { data, error } = await supabase
      .from("creator_list_items")
      .update({
        public_note: parsed.data.publicNote ?? null,
        internal_note: parsed.data.internalNote ?? null,
      })
      .eq("id", parsed.data.itemId)
      .select("creator_list_id")
      .maybeSingle();

    if (error || !data) {
      throwMappedSupabaseError(error ?? { code: "PGRST116", message: "item missing" }, {
        operation: "updateCreatorListItemNotes",
        tableOrRpc: "creator_list_items",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    revalidateListPaths(data.creator_list_id as string);
    return { success: "Notlar güncellendi." };
  } catch (error) {
    return { error: toCreatorListUserMessage(error) };
  }
}

export async function createCreatorListShareAction(
  input: CreateCreatorListShareInput
): Promise<CreatorListActionState> {
  try {
    const { supabase, auth } = await requireAuth();

    if (!isUuid(input.listId) || !EXPIRATION_PRESETS.has(input.expiration)) {
      throw new CreatorListError("validation_failed");
    }

    const list = await getCreatorList(input.listId);
    if (!list) {
      throw new CreatorListError("list_not_found");
    }

    if (list.status === "archived") {
      throw new CreatorListError(
        "validation_failed",
        "Arşivlenmiş listeler paylaşılamaz."
      );
    }

    const now = new Date();
    let expiresAt: string | null;

    try {
      expiresAt = resolveShareExpiresAt(
        input.expiration,
        now,
        input.customExpiresAt
      );
      assertExpiryWithinLimit(expiresAt, now);
    } catch {
      throw new CreatorListError("validation_failed");
    }

    try {
      getPublicReportOrigin();
    } catch {
      throw new CreatorListError("app_origin_invalid");
    }

    const rawToken = generateRawShareToken();
    const tokenHash = hashShareToken(rawToken);
    const label = sanitizeShareLabel(input.label);

    const { data, error } = await supabase
      .from("creator_list_shares")
      .insert({
        creator_list_id: input.listId,
        token_hash: tokenHash,
        created_by: auth.subject,
        expires_at: expiresAt,
        label,
        allow_csv_download: Boolean(input.allowCsvDownload),
      })
      .select("id")
      .single();

    if (error || !data) {
      throwMappedSupabaseError(error ?? { code: "PGRST116", message: "share missing" }, {
        operation: "createCreatorListShare",
        tableOrRpc: "creator_list_shares",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    const publicUrl = getPublicReportUrl(`/lists/${rawToken}`);
    revalidateListPaths(input.listId);

    return {
      success: "Paylaşım bağlantısı oluşturuldu.",
      result: {
        shareId: data.id as string,
        publicUrl,
        expiresAt,
        allowCsvDownload: Boolean(input.allowCsvDownload),
      },
    };
  } catch (error) {
    return { error: toCreatorListUserMessage(error) };
  }
}

export async function revokeCreatorListShareAction(
  shareId: string
): Promise<CreatorListActionState> {
  try {
    const { supabase } = await requireAuth();
    if (!isUuid(shareId)) {
      throw new CreatorListError("share_invalid");
    }

    const existing = await getCreatorListShare(shareId);
    if (!existing) {
      throw new CreatorListError("share_invalid");
    }

    if (existing.status === "revoked") {
      return { success: "Paylaşım zaten iptal edilmiş." };
    }

    const { error } = await supabase
      .from("creator_list_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", shareId)
      .is("revoked_at", null);

    if (error) {
      throwMappedSupabaseError(error, {
        operation: "revokeCreatorListShare",
        tableOrRpc: "creator_list_shares",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    revalidateListPaths(existing.creator_list_id);
    return { success: "Paylaşım bağlantısı iptal edildi." };
  } catch (error) {
    return { error: toCreatorListUserMessage(error) };
  }
}

export async function updateCreatorListShareAction(input: {
  shareId: string;
  allowCsvDownload?: boolean;
  label?: string | null;
  expiresAt?: string | null;
}): Promise<CreatorListActionState> {
  try {
    const { supabase } = await requireAuth();
    if (!isUuid(input.shareId)) {
      throw new CreatorListError("share_invalid");
    }

    const existing = await getCreatorListShare(input.shareId);
    if (!existing) {
      throw new CreatorListError("share_invalid");
    }

    if (existing.status === "revoked") {
      throw new CreatorListError("share_revoked");
    }

    const patch: Record<string, unknown> = {};
    if (typeof input.allowCsvDownload === "boolean") {
      patch.allow_csv_download = input.allowCsvDownload;
    }
    if (input.label !== undefined) {
      patch.label = sanitizeShareLabel(input.label);
    }
    if (input.expiresAt !== undefined) {
      assertExpiryWithinLimit(
        input.expiresAt,
        new Date(),
        new Date(existing.created_at)
      );
      patch.expires_at = input.expiresAt;
    }

    const { error } = await supabase
      .from("creator_list_shares")
      .update(patch)
      .eq("id", input.shareId);

    if (error) {
      throwMappedSupabaseError(error, {
        operation: "updateCreatorListShare",
        tableOrRpc: "creator_list_shares",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    revalidateListPaths(existing.creator_list_id);
    return { success: "Paylaşım güncellendi." };
  } catch (error) {
    return { error: toCreatorListUserMessage(error) };
  }
}

export async function addCreatorListToCampaignAction(input: {
  listId: string;
  campaignId: string;
}): Promise<CreatorListActionState> {
  try {
    const { supabase } = await requireAuth();

    if (!isUuid(input.listId) || !isUuid(input.campaignId)) {
      throw new CreatorListError("validation_failed");
    }

    const list = await getCreatorList(input.listId);
    if (!list) {
      throw new CreatorListError("list_not_found");
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", input.campaignId)
      .maybeSingle();

    if (campaignError) {
      throwMappedSupabaseError(campaignError, {
        operation: "addCreatorListToCampaign",
        tableOrRpc: "campaigns",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    if (!campaign) {
      throw new CreatorListError("campaign_not_found");
    }

    const creatorIds = list.items.map((item) => item.creator_id);
    const selectedCount = creatorIds.length;

    if (selectedCount === 0) {
      return { error: "Listede eklenecek creator yok." };
    }

    const { data: assigned, error: assignedError } = await supabase
      .from("campaign_creators")
      .select("creator_id")
      .eq("campaign_id", input.campaignId)
      .in("creator_id", creatorIds);

    if (assignedError) {
      throwMappedSupabaseError(assignedError, {
        operation: "addCreatorListToCampaign",
        tableOrRpc: "campaign_creators",
        authenticated: true,
        fallback: "database_failure",
      });
    }

    const already = new Set(
      (assigned ?? []).map((row) => row.creator_id as string)
    );
    const missing = creatorIds.filter((id) => !already.has(id));

    if (missing.length > 0) {
      const { error } = await supabase.from("campaign_creators").insert(
        missing.map((creatorId) => ({
          campaign_id: input.campaignId,
          creator_id: creatorId,
          agreed_content_count: 0,
          fee: null,
          notes: null,
        }))
      );

      if (error) {
        throw new CreatorListError("assignment_failure");
      }
    }

    const summary: CampaignHandoffSummary = {
      campaignId: input.campaignId,
      selectedCount,
      alreadyAssignedCount: already.size,
      newlyAssignedCount: missing.length,
    };

    revalidatePath(`/campaigns/${input.campaignId}`);
    revalidateListPaths(input.listId);

    return {
      success: `${summary.newlyAssignedCount} creator kampanyaya eklendi.`,
      campaignSummary: summary,
    };
  } catch (error) {
    return { error: toCreatorListUserMessage(error) };
  }
}
