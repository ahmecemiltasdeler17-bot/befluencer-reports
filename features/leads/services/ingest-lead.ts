import "server-only";

import { extractLeadIdentity } from "@/features/leads/calculations";
import {
  leadIngestSchema,
  parseSubmittedAt,
  sanitizeLeadPayload,
} from "@/features/leads/schemas";
import type { LeadIngestResult } from "@/features/leads/types";
import { bearerMatches } from "@/features/leads/verify-ingest-secret";
import { getLeadIngestSecret } from "@/lib/env.server";
import { logDatabaseError } from "@/lib/supabase/database-error";
import { createClient } from "@/lib/supabase/server";

/** Must match the SQL signature in create_marketing_lead. */
export const CREATE_MARKETING_LEAD_RPC = "create_marketing_lead";

/**
 * Every rejection the marketing site can see uses one of these. The wording is
 * deliberately uniform about *why* a request failed: a public endpoint should
 * not tell a prober whether the secret was wrong or merely absent.
 */
const REJECTED_MESSAGE = "Gönderim reddedildi.";
const UNCONFIGURED_MESSAGE =
  "Form gönderimi henüz yapılandırılmadı. LEADS_INGEST_SECRET tanımlayın.";
const STORAGE_MESSAGE =
  "Gönderim şu an kaydedilemedi. Lütfen daha sonra tekrar deneyin.";

/**
 * Validates one marketing-site submission and stores it.
 *
 * Storage goes through the `create_marketing_lead` security-definer function,
 * so this route needs no service-role key and `anon` keeps zero table
 * privileges — the same shape every other public write in this app uses.
 */
export async function ingestLead(input: {
  authorization: string | null;
  body: unknown;
}): Promise<LeadIngestResult> {
  const secret = getLeadIngestSecret();

  if (!secret) {
    return { ok: false, code: "unconfigured", message: UNCONFIGURED_MESSAGE };
  }

  if (!bearerMatches(input.authorization, secret)) {
    return { ok: false, code: "unauthorized", message: REJECTED_MESSAGE };
  }

  const parsed = leadIngestSchema.safeParse(input.body);

  if (!parsed.success) {
    return { ok: false, code: "invalid_payload", message: REJECTED_MESSAGE };
  }

  const payload = sanitizeLeadPayload(parsed.data.data);
  const identity = extractLeadIdentity(parsed.data.kind, payload);

  if (identity.fullName.length === 0 || identity.email.length === 0) {
    return { ok: false, code: "invalid_payload", message: REJECTED_MESSAGE };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc(CREATE_MARKETING_LEAD_RPC, {
    p_kind: parsed.data.kind,
    p_full_name: identity.fullName,
    p_email: identity.email,
    p_phone: identity.phone,
    p_payload: payload,
    p_submitted_at: parseSubmittedAt(parsed.data.submittedAt),
  });

  if (error) {
    logDatabaseError(error, { operation: "ingestLead", table: "leads" });
    return { ok: false, code: "storage_error", message: STORAGE_MESSAGE };
  }

  if (typeof data !== "string" || data.length === 0) {
    logDatabaseError(
      { message: "create_marketing_lead returned no id" },
      { operation: "ingestLead", table: "leads" }
    );
    return { ok: false, code: "storage_error", message: STORAGE_MESSAGE };
  }

  return { ok: true, id: data };
}
