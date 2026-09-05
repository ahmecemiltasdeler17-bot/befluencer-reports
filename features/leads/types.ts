export const LEAD_KINDS = ["brand_inquiry", "creator_application"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "archived",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** One inbound marketing-site form submission. */
export type Lead = {
  id: string;
  kind: LeadKind;
  status: LeadStatus;
  full_name: string;
  email: string;
  phone: string | null;
  /** Raw submitted fields, minus consent and honeypot. */
  payload: Record<string, unknown>;
  admin_note: string | null;
  creator_id: string | null;
  submitted_at: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
};

export type LeadCreatorLink = {
  id: string;
  username: string;
  platform: string;
};

export type LeadWithCreator = Lead & {
  creator: LeadCreatorLink | null;
};

export type LeadStatusCounts = Record<LeadStatus, number>;

export type LeadActionState = {
  error?: string;
  success?: string;
};

/** Result of ingesting one submission from the marketing site. */
export type LeadIngestResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "unconfigured"
        | "invalid_payload"
        | "rate_limited"
        | "storage_error";
      message: string;
    };
