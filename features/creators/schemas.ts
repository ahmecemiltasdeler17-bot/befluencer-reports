import { z } from "zod";

import {
  CREATOR_CATEGORIES,
  CREATOR_PLATFORMS,
  type CampaignCreator,
  type CampaignCreatorFormValues,
  type CreateAndAssignFormValues,
  type Creator,
  type CreatorFormValues,
} from "@/features/creators/types";

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

export const usernameSchema = z
  .string({ error: "Kullanıcı adı gereklidir." })
  .trim()
  .transform((value) => value.replace(/^@+/, ""))
  .pipe(
    z
      .string()
      .min(1, "Kullanıcı adı gereklidir.")
      .max(100, "Kullanıcı adı en fazla 100 karakter olabilir.")
  )
  .transform((value) => value.toLowerCase());

const categorySchema = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? null : value))
  .refine(
    (value) =>
      value === null ||
      (CREATOR_CATEGORIES as readonly string[]).includes(value),
    "Geçerli bir kategori seçin."
  )
  .transform((value) => value as (typeof CREATOR_CATEGORIES)[number] | null);

export const creatorFormSchema = z.object({
  platform: z.enum(CREATOR_PLATFORMS, {
    error: "Geçerli bir platform seçin.",
  }),
  username: usernameSchema,
  display_name: optionalText.pipe(
    z
      .string()
      .max(150, "Görünen ad en fazla 150 karakter olabilir.")
      .nullable()
  ),
  profile_url: optionalUrl,
  avatar_url: optionalUrl,
  follower_count: z.coerce
    .number({ error: "Takipçi sayısı gereklidir." })
    .int("Takipçi sayısı tam sayı olmalıdır.")
    .min(0, "Takipçi sayısı 0 veya daha büyük olmalıdır."),
  category: categorySchema,
});

export const campaignCreatorFieldsSchema = z.object({
  agreed_content_count: z.coerce
    .number({ error: "Anlaşılan içerik sayısı gereklidir." })
    .int("Tam sayı olmalıdır.")
    .min(1, "En az 1 olmalıdır."),
  fee: z
    .union([z.literal(""), z.coerce.number().min(0, "Ücret 0 veya daha büyük olmalıdır.")])
    .transform((value) => (value === "" ? null : value)),
  notes: optionalText.pipe(
    z
      .string()
      .max(2000, "Notlar en fazla 2000 karakter olabilir.")
      .nullable()
  ),
});

export const createAndAssignFormSchema = creatorFormSchema.merge(
  campaignCreatorFieldsSchema
);

export type CreatorFormInput = z.infer<typeof creatorFormSchema>;
export type CampaignCreatorFieldsInput = z.infer<
  typeof campaignCreatorFieldsSchema
>;
export type CreateAndAssignFormInput = z.infer<typeof createAndAssignFormSchema>;

export function parseCreatorFormData(formData: FormData) {
  return {
    platform: String(formData.get("platform") ?? "tiktok"),
    username: String(formData.get("username") ?? ""),
    display_name: String(formData.get("display_name") ?? ""),
    profile_url: String(formData.get("profile_url") ?? ""),
    avatar_url: String(formData.get("avatar_url") ?? ""),
    follower_count: String(formData.get("follower_count") ?? "0"),
    category: String(formData.get("category") ?? ""),
  };
}

export function parseCampaignCreatorFormData(formData: FormData) {
  return {
    agreed_content_count: String(formData.get("agreed_content_count") ?? "1"),
    fee: String(formData.get("fee") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export function parseCreateAndAssignFormData(formData: FormData) {
  return {
    ...parseCreatorFormData(formData),
    ...parseCampaignCreatorFormData(formData),
  };
}

export function toCreatorFormValues(
  input: CreatorFormInput
): CreatorFormValues {
  return {
    platform: input.platform,
    username: input.username,
    display_name: input.display_name ?? "",
    profile_url: input.profile_url ?? "",
    avatar_url: input.avatar_url ?? "",
    follower_count: String(input.follower_count),
    category: input.category ?? "",
  };
}

export function toCampaignCreatorFormValues(
  input: CampaignCreatorFieldsInput
): CampaignCreatorFormValues {
  return {
    agreed_content_count: String(input.agreed_content_count),
    fee: input.fee === null ? "" : String(input.fee),
    notes: input.notes ?? "",
  };
}

export function toCreateAndAssignFormValues(
  input: CreateAndAssignFormInput
): CreateAndAssignFormValues {
  return {
    ...toCreatorFormValues(input),
    ...toCampaignCreatorFormValues(input),
  };
}

export function creatorToFormValues(creator: Creator): CreatorFormValues {
  return {
    platform: creator.platform,
    username: creator.username,
    display_name: creator.display_name ?? "",
    profile_url: creator.profile_url ?? "",
    avatar_url: creator.avatar_url ?? "",
    follower_count: String(creator.follower_count),
    category: creator.category ?? "",
  };
}

export function campaignCreatorToFormValues(
  assignment: Pick<CampaignCreator, "agreed_content_count" | "fee" | "notes">
): CampaignCreatorFormValues {
  return {
    agreed_content_count: String(assignment.agreed_content_count),
    fee: assignment.fee === null ? "" : String(assignment.fee),
    notes: assignment.notes ?? "",
  };
}
