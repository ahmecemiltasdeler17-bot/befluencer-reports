"use server";

import { revalidatePath } from "next/cache";

import { extractTikTokUsername } from "@/features/leads/calculations";
import { getLeadById } from "@/features/leads/queries";
import {
  leadConvertSchema,
  leadNoteSchema,
  leadStatusUpdateSchema,
} from "@/features/leads/schemas";
import type { LeadActionState } from "@/features/leads/types";
import { buildTikTokProfileUrl } from "@/lib/providers/tiktok/profile-url";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "İşlem tamamlanamadı. Lütfen tekrar deneyin.";

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return supabase;
}

function revalidateLeadSurfaces(): void {
  revalidatePath("/leads");
}

export async function updateLeadStatusAction(
  _prev: LeadActionState | null,
  formData: FormData
): Promise<LeadActionState> {
  const parsed = leadStatusUpdateSchema.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });

  if (!parsed.success) {
    return { error: "Geçersiz durum seçimi." };
  }

  try {
    const supabase = await requireAuthenticatedClient();
    const { error } = await supabase
      .from("leads")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.leadId);

    if (error) {
      return { error: GENERIC_ERROR };
    }
  } catch {
    return { error: GENERIC_ERROR };
  }

  revalidateLeadSurfaces();
  return { success: "Durum güncellendi." };
}

export async function saveLeadNoteAction(
  _prev: LeadActionState | null,
  formData: FormData
): Promise<LeadActionState> {
  const parsed = leadNoteSchema.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    note: String(formData.get("note") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Not kaydedilemedi.",
    };
  }

  const note = parsed.data.note.length > 0 ? parsed.data.note : null;

  try {
    const supabase = await requireAuthenticatedClient();
    const { error } = await supabase
      .from("leads")
      .update({ admin_note: note })
      .eq("id", parsed.data.leadId);

    if (error) {
      return { error: GENERIC_ERROR };
    }
  } catch {
    return { error: GENERIC_ERROR };
  }

  revalidateLeadSurfaces();
  return { success: "Not kaydedildi." };
}

/**
 * Turns a creator application into a creator record — only when an admin asks.
 *
 * Nothing about the application is trusted as a metric: the new row carries the
 * handle, the applicant's name and the profile URL, and nothing else. Follower
 * count stays 0 and the category stays uncategorized until a real TikTok sync
 * fills them in, so a self-reported "100K–500K" never becomes stored data.
 *
 * An existing creator with the same handle is linked rather than duplicated.
 */
export async function convertLeadToCreatorAction(
  _prev: LeadActionState | null,
  formData: FormData
): Promise<LeadActionState> {
  const parsed = leadConvertSchema.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
  });

  if (!parsed.success) {
    return { error: "Geçersiz kayıt." };
  }

  try {
    const lead = await getLeadById(parsed.data.leadId);

    if (!lead) {
      return { error: "Kayıt bulunamadı." };
    }

    if (lead.kind !== "creator_application") {
      return { error: "Yalnızca creator başvuruları eklenebilir." };
    }

    if (lead.creator_id) {
      return { error: "Bu başvuru zaten bir içerik üreticisine bağlı." };
    }

    const username = extractTikTokUsername(lead.payload.tiktokUrl);

    if (!username) {
      return {
        error:
          "TikTok kullanıcı adı çıkarılamadı. Creator'ı elle ekleyip bu kaydı arşivleyin.",
      };
    }

    const supabase = await requireAuthenticatedClient();

    const { data: existing, error: lookupError } = await supabase
      .from("creators")
      .select("id")
      .eq("platform", "tiktok")
      .eq("username", username)
      .maybeSingle();

    if (lookupError) {
      return { error: GENERIC_ERROR };
    }

    let creatorId = existing?.id as string | undefined;
    let created = false;

    if (!creatorId) {
      const { data: inserted, error: insertError } = await supabase
        .from("creators")
        .insert({
          platform: "tiktok",
          username,
          display_name: lead.full_name,
          profile_url: buildTikTokProfileUrl(username),
          follower_count: 0,
          category: null,
          category_source: "auto",
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        return { error: GENERIC_ERROR };
      }

      creatorId = inserted.id as string;
      created = true;
    }

    const { error: linkError } = await supabase
      .from("leads")
      .update({ creator_id: creatorId, status: "qualified" })
      .eq("id", lead.id);

    if (linkError) {
      return { error: GENERIC_ERROR };
    }

    revalidateLeadSurfaces();
    revalidatePath("/creators");

    return {
      success: created
        ? `@${username} eklendi. Takipçi sayısı için TikTok senkronunu çalıştırın.`
        : `@${username} zaten kayıtlıydı, başvuru bu içerik üreticisine bağlandı.`,
    };
  } catch {
    return { error: GENERIC_ERROR };
  }
}
