"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  campaignCreatorFieldsSchema,
  createAndAssignFormSchema,
  creatorFormSchema,
  parseCampaignCreatorFormData,
  parseCreateAndAssignFormData,
  parseCreatorFormData,
  toCampaignCreatorFormValues,
  toCreateAndAssignFormValues,
  toCreatorFormValues,
} from "@/features/creators/schemas";
import { calculateCreatorCategory } from "@/features/creators/calculate-creator-category";
import { getCampaignById } from "@/features/campaigns/queries";
import {
  getCreatorById,
  isCreatorAssignedToCampaign,
  searchCreators,
} from "@/features/creators/queries";
import {
  CREATOR_HAS_VIDEOS_DELETE_ERROR,
  countVideosByCreatorId,
  runDeleteCreators,
  type DeleteCreatorsPort,
} from "@/features/creators/services/delete-creators-core";
import type {
  AssignCreatorFormState,
  Creator,
  CreatorFormState,
} from "@/features/creators/types";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapSupabaseMutationError(
  message: string,
  code?: string,
  context?: "creator" | "assignment"
): string {
  if (code === "23505") {
    if (context === "assignment") {
      return "Bu içerik üreticisi zaten bu kampanyaya eklenmiş.";
    }
    return "Bu platform ve kullanıcı adı kombinasyonu zaten kayıtlı.";
  }

  if (
    code === "23503" ||
    message.toLowerCase().includes("videos_creator_id_fkey") ||
    message.toLowerCase().includes("violates foreign key constraint")
  ) {
    return CREATOR_HAS_VIDEOS_DELETE_ERROR;
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  if (normalized.includes("jwt")) {
    return "Oturumunuz geçersiz. Lütfen tekrar giriş yapın.";
  }

  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    redirect("/login");
  }

  return supabase;
}

function collectFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

async function assertCampaignExists(campaignId: string) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    redirect("/campaigns");
  }
  return campaign;
}

async function assertCreatorExists(creatorId: string) {
  const creator = await getCreatorById(creatorId);
  if (!creator) {
    redirect("/creators");
  }
  return creator;
}

function revalidateCreatorPaths(creatorId: string) {
  revalidatePath("/creators");
  revalidatePath(`/creators/${creatorId}`);
  revalidatePath(`/creators/${creatorId}/edit`);
}

function revalidateCampaignCreatorPaths(campaignId: string, creatorId?: string) {
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/creators/add`);

  if (creatorId) {
    revalidatePath(`/campaigns/${campaignId}/creators/${creatorId}/edit`);
  }

  revalidatePath("/creators");
}

export async function searchCreatorsAction(query: string): Promise<Creator[]> {
  await requireAuthenticatedClient();
  return searchCreators(query);
}

export async function createCreator(
  _prevState: CreatorFormState,
  formData: FormData
): Promise<CreatorFormState> {
  const raw = parseCreatorFormData(formData);
  const parsed = creatorFormSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      values: raw as CreatorFormState["values"],
    };
  }

  const supabase = await requireAuthenticatedClient();
  const values = parsed.data;
  const categorySource = values.category === null ? "auto" : "manual";
  const category =
    categorySource === "auto"
      ? calculateCreatorCategory(values.follower_count)
      : values.category;

  const { data, error } = await supabase
    .from("creators")
    .insert({
      platform: values.platform,
      username: values.username,
      display_name: values.display_name,
      profile_url: values.profile_url,
      avatar_url: values.avatar_url,
      follower_count: values.follower_count,
      category,
      // Selecting a category in the form is a manual override; empty stays auto.
      category_source: categorySource,
    })
    .select("id")
    .single();

  if (error) {
    return {
      error: mapSupabaseMutationError(error.message, error.code, "creator"),
      values: toCreatorFormValues(values),
    };
  }

  revalidatePath("/creators");
  redirect(`/creators/${data.id}`);
}

export async function updateCreator(
  id: string,
  _prevState: CreatorFormState,
  formData: FormData
): Promise<CreatorFormState> {
  const raw = parseCreatorFormData(formData);
  const parsed = creatorFormSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      values: raw as CreatorFormState["values"],
    };
  }

  const supabase = await requireAuthenticatedClient();
  const values = parsed.data;
  const categorySource = values.category === null ? "auto" : "manual";
  const category =
    categorySource === "auto"
      ? calculateCreatorCategory(values.follower_count)
      : values.category;

  const { error } = await supabase
    .from("creators")
    .update({
      platform: values.platform,
      username: values.username,
      display_name: values.display_name,
      profile_url: values.profile_url,
      avatar_url: values.avatar_url,
      follower_count: values.follower_count,
      category,
      category_source: categorySource,
    })
    .eq("id", id);

  if (error) {
    return {
      error: mapSupabaseMutationError(error.message, error.code, "creator"),
      values: toCreatorFormValues(values),
    };
  }

  revalidateCreatorPaths(id);
  revalidatePath("/campaigns");
  redirect(`/creators/${id}`);
}

/**
 * Switches a creator back to automatic tiering and recalculates from the
 * current follower_count. Does not call the provider.
 */
export async function resetCreatorCategoryToAutoAction(
  creatorId: string
): Promise<{ error?: string; success?: string }> {
  const supabase = await requireAuthenticatedClient();

  if (!UUID_PATTERN.test(creatorId)) {
    return { error: "Geçersiz içerik üreticisi kimliği." };
  }

  const creator = await getCreatorById(creatorId);
  if (!creator) {
    return { error: "İçerik üreticisi bulunamadı." };
  }

  const category = calculateCreatorCategory(creator.follower_count);

  const { error } = await supabase
    .from("creators")
    .update({
      category_source: "auto",
      category,
    })
    .eq("id", creatorId);

  if (error) {
    return { error: mapSupabaseMutationError(error.message, error.code, "creator") };
  }

  revalidateCreatorPaths(creatorId);
  return { success: "Kategori otomatik moda alındı." };
}

export async function assignCreatorToCampaign(
  campaignId: string,
  creatorId: string,
  _prevState: AssignCreatorFormState,
  formData: FormData
): Promise<AssignCreatorFormState> {
  await assertCampaignExists(campaignId);
  await assertCreatorExists(creatorId);

  const raw = parseCampaignCreatorFormData(formData);
  const parsed = campaignCreatorFieldsSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      values: raw,
    };
  }

  if (await isCreatorAssignedToCampaign(campaignId, creatorId)) {
    return {
      error: "Bu içerik üreticisi zaten bu kampanyaya eklenmiş.",
      values: toCampaignCreatorFormValues(parsed.data),
    };
  }

  const supabase = await requireAuthenticatedClient();
  const values = parsed.data;

  const { error } = await supabase.from("campaign_creators").insert({
    campaign_id: campaignId,
    creator_id: creatorId,
    agreed_content_count: values.agreed_content_count,
    fee: values.fee,
    notes: values.notes,
  });

  if (error) {
    return {
      error: mapSupabaseMutationError(error.message, error.code, "assignment"),
      values: toCampaignCreatorFormValues(values),
    };
  }

  revalidateCampaignCreatorPaths(campaignId, creatorId);
  revalidateCreatorPaths(creatorId);
  redirect(`/campaigns/${campaignId}`);
}

export async function createCreatorAndAssignToCampaign(
  campaignId: string,
  _prevState: CreatorFormState,
  formData: FormData
): Promise<CreatorFormState> {
  await assertCampaignExists(campaignId);

  const raw = parseCreateAndAssignFormData(formData);
  const parsed = createAndAssignFormSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      values: raw as CreatorFormState["values"],
    };
  }

  const supabase = await requireAuthenticatedClient();
  const values = parsed.data;
  const categorySource = values.category === null ? "auto" : "manual";
  const category =
    categorySource === "auto"
      ? calculateCreatorCategory(values.follower_count)
      : values.category;

  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .insert({
      platform: values.platform,
      username: values.username,
      display_name: values.display_name,
      profile_url: values.profile_url,
      avatar_url: values.avatar_url,
      follower_count: values.follower_count,
      category,
      category_source: categorySource,
    })
    .select("id")
    .single();

  if (creatorError) {
    return {
      error: mapSupabaseMutationError(
        creatorError.message,
        creatorError.code,
        "creator"
      ),
      values: toCreateAndAssignFormValues(values),
    };
  }

  const { error: assignError } = await supabase.from("campaign_creators").insert({
    campaign_id: campaignId,
    creator_id: creator.id,
    agreed_content_count: values.agreed_content_count,
    fee: values.fee,
    notes: values.notes,
  });

  if (assignError) {
    await supabase.from("creators").delete().eq("id", creator.id);

    return {
      error: mapSupabaseMutationError(
        assignError.message,
        assignError.code,
        "assignment"
      ),
      values: toCreateAndAssignFormValues(values),
    };
  }

  revalidateCampaignCreatorPaths(campaignId, creator.id);
  revalidateCreatorPaths(creator.id);
  redirect(`/campaigns/${campaignId}`);
}

export async function removeCreatorFromCampaign(
  campaignId: string,
  creatorId: string
): Promise<{ error?: string }> {
  await assertCampaignExists(campaignId);

  const supabase = await requireAuthenticatedClient();

  const { error } = await supabase
    .from("campaign_creators")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("creator_id", creatorId);

  if (error) {
    return {
      error: mapSupabaseMutationError(error.message, error.code, "assignment"),
    };
  }

  revalidateCampaignCreatorPaths(campaignId, creatorId);
  revalidateCreatorPaths(creatorId);
  return {};
}

export async function updateCampaignCreator(
  campaignId: string,
  creatorId: string,
  _prevState: AssignCreatorFormState,
  formData: FormData
): Promise<AssignCreatorFormState> {
  await assertCampaignExists(campaignId);
  await assertCreatorExists(creatorId);

  const raw = parseCampaignCreatorFormData(formData);
  const parsed = campaignCreatorFieldsSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      values: raw,
    };
  }

  const supabase = await requireAuthenticatedClient();
  const values = parsed.data;

  const { error } = await supabase
    .from("campaign_creators")
    .update({
      agreed_content_count: values.agreed_content_count,
      fee: values.fee,
      notes: values.notes,
    })
    .eq("campaign_id", campaignId)
    .eq("creator_id", creatorId);

  if (error) {
    return {
      error: mapSupabaseMutationError(error.message, error.code, "assignment"),
      values: toCampaignCreatorFormValues(values),
    };
  }

  revalidateCampaignCreatorPaths(campaignId, creatorId);
  revalidateCreatorPaths(creatorId);
  redirect(`/campaigns/${campaignId}`);
}

async function createDeleteCreatorsPort(): Promise<DeleteCreatorsPort> {
  const supabase = await requireAuthenticatedClient();

  return {
    async isAuthenticated() {
      return true;
    },
    async loadCandidates(ids: string[]) {
      const { data: creators, error } = await supabase
        .from("creators")
        .select("id, username")
        .in("id", ids);

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }

      const found = creators ?? [];
      if (found.length === 0) {
        return [];
      }

      const foundIds = found.map((row) => row.id as string);

      // Fail-closed: any relation query error must abort delete (never treat as 0 videos).
      const [assignmentsResult, videosResult] = await Promise.all([
        supabase
          .from("campaign_creators")
          .select("creator_id")
          .in("creator_id", foundIds),
        supabase
          .from("videos")
          .select("creator_id")
          .in("creator_id", foundIds),
      ]);

      if (videosResult.error) {
        throw new Error(
          "Bağlı videolar doğrulanamadı. Silme iptal edildi. Lütfen tekrar deneyin."
        );
      }

      if (assignmentsResult.error) {
        throw new Error(
          "Kampanya atamaları doğrulanamadı. Silme iptal edildi. Lütfen tekrar deneyin."
        );
      }

      const campaignCountById = new Map<string, number>();
      for (const row of assignmentsResult.data ?? []) {
        const id = row.creator_id as string;
        campaignCountById.set(id, (campaignCountById.get(id) ?? 0) + 1);
      }

      const videoCountById = countVideosByCreatorId(
        (videosResult.data ?? []) as Array<{ creator_id: string }>,
        foundIds
      );

      return found.map((row) => ({
        id: row.id as string,
        username: (row.username as string) ?? "unknown",
        campaignCount: campaignCountById.get(row.id as string) ?? 0,
        videoCount: videoCountById.get(row.id as string) ?? 0,
      }));
    },
    async deleteByIds(ids: string[]) {
      // Defense in depth: re-check videos immediately before delete.
      const { count, error: countError } = await supabase
        .from("videos")
        .select("id", { count: "exact", head: true })
        .in("creator_id", ids);

      if (countError) {
        throw new Error(
          "Bağlı videolar doğrulanamadı. Silme iptal edildi. Lütfen tekrar deneyin."
        );
      }

      if ((count ?? 0) > 0) {
        throw new Error(CREATOR_HAS_VIDEOS_DELETE_ERROR);
      }

      // campaign_creators / list items / metric snapshots cascade.
      // videos FK must be RESTRICT. report_versions JSONB is untouched.
      const { error } = await supabase.from("creators").delete().in("id", ids);
      if (error) {
        throw new Error(
          mapSupabaseMutationError(error.message, error.code, "creator")
        );
      }
    },
  };
}

/**
 * Hard-deletes creators from the global pool after video RESTRICT preflight.
 * Requires explicit UI confirmation — never called automatically.
 */
export async function deleteCreatorsAction(
  creatorIds: string[]
): Promise<{
  error?: string;
  success?: string;
  deleted?: number;
  blocked?: number;
  failed?: number;
  deletedIds?: string[];
  blockedIds?: string[];
}> {
  const uniqueIds = [...new Set(creatorIds)].filter((id) =>
    UUID_PATTERN.test(id)
  );

  if (uniqueIds.length === 0) {
    return { error: "Silinecek içerik üreticisi seçilmedi." };
  }

  try {
    const port = await createDeleteCreatorsPort();
    const result = await runDeleteCreators(uniqueIds, port);

    if (result.deleted > 0) {
      revalidatePath("/creators");
      revalidatePath("/campaigns");
      revalidatePath("/creator-lists");
    }

    return {
      success: result.deleted > 0 ? result.success : undefined,
      error: result.error,
      deleted: result.deleted,
      blocked: result.blocked,
      failed: result.failed,
      deletedIds: result.deletedIds,
      blockedIds: result.blockedIds,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Silme işlemi tamamlanamadı. Lütfen tekrar deneyin.",
    };
  }
}

/**
 * Hard-deletes creators that are soft-marked unavailable.
 * Requires explicit confirmation from the UI — never called automatically.
 * Uses the same video preflight as general delete.
 */
export async function deleteUnavailableCreatorsAction(
  creatorIds: string[]
): Promise<{ error?: string; success?: string; deleted?: number }> {
  const supabase = await requireAuthenticatedClient();

  const uniqueIds = [...new Set(creatorIds)].filter((id) =>
    UUID_PATTERN.test(id)
  );

  if (uniqueIds.length === 0) {
    return { error: "Silinecek pasif hesap seçilmedi." };
  }

  const { data: rows, error: readError } = await supabase
    .from("creators")
    .select("id")
    .in("id", uniqueIds)
    .eq("account_status", "unavailable");

  if (readError) {
    return { error: mapSupabaseMutationError(readError.message, readError.code) };
  }

  const unavailableIds = (rows ?? []).map((row) => row.id as string);

  if (unavailableIds.length === 0) {
    return { error: "Seçilen kayıtlar arasında pasif hesap bulunamadı." };
  }

  return deleteCreatorsAction(unavailableIds);
}
