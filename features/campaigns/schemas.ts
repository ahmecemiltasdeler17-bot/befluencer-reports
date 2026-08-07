import { z } from "zod";

import {
  CAMPAIGN_STATUSES,
  type Campaign,
  type CampaignFormValues,
} from "@/features/campaigns/types";

const optionalText = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? null : value));

const optionalUrl = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? null : value))
  .refine(
    (value) => value === null || /^https?:\/\/.+/i.test(value),
    "Geçerli bir URL girin."
  );

const optionalDate = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? null : value))
  .refine(
    (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Geçerli bir tarih girin."
  );

export const campaignFormSchema = z
  .object({
    name: z
      .string({ error: "Kampanya adı gereklidir." })
      .trim()
      .min(1, "Kampanya adı gereklidir.")
      .max(200, "Kampanya adı en fazla 200 karakter olabilir."),
    artist_name: z
      .string({ error: "Sanatçı adı gereklidir." })
      .trim()
      .min(1, "Sanatçı adı gereklidir.")
      .max(200, "Sanatçı adı en fazla 200 karakter olabilir."),
    track_name: z
      .string({ error: "Şarkı adı gereklidir." })
      .trim()
      .min(1, "Şarkı adı gereklidir.")
      .max(200, "Şarkı adı en fazla 200 karakter olabilir."),
    client_name: optionalText,
    sound_url: optionalUrl,
    status: z.enum(CAMPAIGN_STATUSES, {
      error: "Geçerli bir durum seçin.",
    }),
    start_date: optionalDate,
    end_date: optionalDate,
    report_number: optionalText,
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.end_date && data.end_date < data.start_date) {
      ctx.addIssue({
        code: "custom",
        message: "Bitiş tarihi başlangıç tarihinden önce olamaz.",
        path: ["end_date"],
      });
    }
  });

export type CampaignFormInput = z.infer<typeof campaignFormSchema>;

export function parseCampaignFormData(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    artist_name: String(formData.get("artist_name") ?? ""),
    track_name: String(formData.get("track_name") ?? ""),
    client_name: String(formData.get("client_name") ?? ""),
    sound_url: String(formData.get("sound_url") ?? ""),
    status: String(formData.get("status") ?? "draft"),
    start_date: String(formData.get("start_date") ?? ""),
    end_date: String(formData.get("end_date") ?? ""),
    report_number: String(formData.get("report_number") ?? ""),
  };
}

export function toCampaignFormValues(
  input: CampaignFormInput
): CampaignFormValues {
  return {
    name: input.name,
    artist_name: input.artist_name,
    track_name: input.track_name,
    client_name: input.client_name ?? "",
    sound_url: input.sound_url ?? "",
    status: input.status,
    start_date: input.start_date ?? "",
    end_date: input.end_date ?? "",
    report_number: input.report_number ?? "",
  };
}

export function campaignToFormValues(campaign: Campaign): CampaignFormValues {
  return {
    name: campaign.name,
    artist_name: campaign.artist_name,
    track_name: campaign.track_name,
    client_name: campaign.client_name ?? "",
    sound_url: campaign.sound_url ?? "",
    status: campaign.status,
    start_date: campaign.start_date ?? "",
    end_date: campaign.end_date ?? "",
    report_number: campaign.report_number ?? "",
  };
}
