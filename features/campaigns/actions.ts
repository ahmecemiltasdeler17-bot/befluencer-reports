"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  campaignFormSchema,
  parseCampaignFormData,
  toCampaignFormValues,
} from "@/features/campaigns/schemas";
import type { CampaignFormState } from "@/features/campaigns/types";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function mapSupabaseMutationError(message: string, code?: string): string {
  if (code === "23505" || message.toLowerCase().includes("duplicate")) {
    return "Bu rapor numarası zaten kullanılıyor.";
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

function validationFailure(
  fieldErrors: CampaignFormState["fieldErrors"],
  values: CampaignFormState["values"]
): CampaignFormState {
  return { fieldErrors, values };
}

export async function createCampaign(
  _prevState: CampaignFormState,
  formData: FormData
): Promise<CampaignFormState> {
  const raw = parseCampaignFormData(formData);
  const parsed = campaignFormSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: CampaignFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key as keyof typeof fieldErrors]) {
        fieldErrors[key as keyof typeof fieldErrors] = issue.message;
      }
    }

    return validationFailure(fieldErrors, raw as CampaignFormState["values"]);
  }

  const supabase = await requireAuthenticatedClient();
  const values = parsed.data;

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name: values.name,
      artist_name: values.artist_name,
      track_name: values.track_name,
      client_name: values.client_name,
      sound_url: values.sound_url,
      status: values.status,
      start_date: values.start_date,
      end_date: values.end_date,
      report_number: values.report_number,
    })
    .select("id")
    .single();

  if (error) {
    return {
      error: mapSupabaseMutationError(error.message, error.code),
      values: toCampaignFormValues(values),
    };
  }

  revalidatePath("/");
  revalidatePath("/campaigns");
  redirect(`/campaigns/${data.id}`);
}

export async function updateCampaign(
  id: string,
  _prevState: CampaignFormState,
  formData: FormData
): Promise<CampaignFormState> {
  const raw = parseCampaignFormData(formData);
  const parsed = campaignFormSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: CampaignFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key as keyof typeof fieldErrors]) {
        fieldErrors[key as keyof typeof fieldErrors] = issue.message;
      }
    }

    return validationFailure(fieldErrors, raw as CampaignFormState["values"]);
  }

  const supabase = await requireAuthenticatedClient();
  const values = parsed.data;

  const { error } = await supabase
    .from("campaigns")
    .update({
      name: values.name,
      artist_name: values.artist_name,
      track_name: values.track_name,
      client_name: values.client_name,
      sound_url: values.sound_url,
      status: values.status,
      start_date: values.start_date,
      end_date: values.end_date,
      report_number: values.report_number,
    })
    .eq("id", id);

  if (error) {
    return {
      error: mapSupabaseMutationError(error.message, error.code),
      values: toCampaignFormValues(values),
    };
  }

  revalidatePath("/");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
  revalidatePath(`/campaigns/${id}/edit`);
  redirect(`/campaigns/${id}`);
}

export async function archiveCampaign(id: string): Promise<{ error?: string }> {
  const supabase = await requireAuthenticatedClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) {
    return { error: mapSupabaseMutationError(error.message, error.code) };
  }

  revalidatePath("/");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
  return {};
}
