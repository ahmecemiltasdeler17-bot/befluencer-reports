import { z } from "zod";

import { LEAD_KINDS, LEAD_STATUSES } from "@/features/leads/types";

/**
 * Ingest contract for POST /api/public/leads.
 *
 * The marketing site already validates its own forms, but this app must not
 * trust that: the request arrives over the public internet with a shared
 * secret, so the body is re-validated and bounded here. Field-level rules stay
 * deliberately loose beyond identity — the marketing site can add a question
 * without a deploy on this side — while size limits stay strict.
 */

const MAX_FIELDS = 40;
const MAX_FIELD_LENGTH = 4_000;

const submittedFieldSchema = z.union([
  z.string().max(MAX_FIELD_LENGTH, "Alan çok uzun."),
  z.number(),
  z.boolean(),
  z.null(),
]);

const submittedDataSchema = z
  .record(z.string().max(100), submittedFieldSchema)
  .refine(
    (data) => Object.keys(data).length > 0,
    "Form alanları boş olamaz."
  )
  .refine(
    (data) => Object.keys(data).length <= MAX_FIELDS,
    "Form alanı sayısı sınırı aşıldı."
  );

const brandIdentitySchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad gerekli."),
  workEmail: z.string().trim().email("Geçerli bir e-posta gerekli."),
});

const creatorIdentitySchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad gerekli."),
  email: z.string().trim().email("Geçerli bir e-posta gerekli."),
});

export const leadIngestSchema = z
  .object({
    kind: z.enum(LEAD_KINDS),
    submittedAt: z.string().trim().optional(),
    data: submittedDataSchema,
  })
  .superRefine((value, ctx) => {
    const identity =
      value.kind === "brand_inquiry"
        ? brandIdentitySchema.safeParse(value.data)
        : creatorIdentitySchema.safeParse(value.data);

    if (!identity.success) {
      ctx.addIssue({
        code: "custom",
        path: ["data"],
        message: "Ad soyad ve e-posta alanları gerekli.",
      });
    }
  });

export type LeadIngestInput = z.infer<typeof leadIngestSchema>;

/**
 * Consent and honeypot never reach storage: consent is a submit precondition
 * the marketing site enforces, and the honeypot is an anti-spam artifact.
 */
const STRIPPED_FIELDS = new Set(["consent", "website"]);

export function sanitizeLeadPayload(
  data: Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (STRIPPED_FIELDS.has(key)) {
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        payload[key] = trimmed;
      }
      continue;
    }
    if (value !== null && value !== undefined) {
      payload[key] = value;
    }
  }

  return payload;
}

/** ISO timestamp reported by the sender, or null when absent/unparseable. */
export function parseSubmittedAt(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export const leadStatusUpdateSchema = z.object({
  leadId: z.string().uuid("Geçersiz kayıt."),
  status: z.enum(LEAD_STATUSES),
});

export const leadNoteSchema = z.object({
  leadId: z.string().uuid("Geçersiz kayıt."),
  note: z
    .string()
    .trim()
    .max(2_000, "Not en fazla 2000 karakter olabilir."),
});

export const leadConvertSchema = z.object({
  leadId: z.string().uuid("Geçersiz kayıt."),
});
