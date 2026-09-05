import { LEAD_KINDS, LEAD_STATUSES } from "@/features/leads/types";
import type { LeadKind, LeadStatus } from "@/features/leads/types";

/**
 * Pure helpers for inbound marketing leads.
 *
 * The marketing site owns its own field names, so everything here reads the
 * payload defensively: a renamed or missing field degrades to an empty value
 * instead of throwing, and nothing is invented to fill a gap.
 */

export function isLeadKind(value: unknown): value is LeadKind {
  return (
    typeof value === "string" && (LEAD_KINDS as readonly string[]).includes(value)
  );
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === "string" &&
    (LEAD_STATUSES as readonly string[]).includes(value)
  );
}

function readText(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Identity columns for one submission.
 *
 * Brand inquiries carry a work email, creator applications a personal one; both
 * are stored in the same column so the list can be searched uniformly.
 */
export function extractLeadIdentity(
  kind: LeadKind,
  payload: Record<string, unknown>
): { fullName: string; email: string; phone: string | null } {
  const fullName = readText(payload, "fullName");
  const email =
    kind === "brand_inquiry"
      ? readText(payload, "workEmail")
      : readText(payload, "email");
  const phone = readText(payload, "phone");

  return {
    fullName,
    email: email.toLowerCase(),
    phone: phone.length > 0 ? phone : null,
  };
}

const BRAND_FIELD_LABELS: Array<[string, string]> = [
  ["company", "Şirket"],
  ["workEmail", "İş e-postası"],
  ["phone", "Telefon"],
  ["campaignType", "Kampanya tipi"],
  ["targetPlatform", "Hedef platform"],
  ["budget", "Bütçe"],
  ["timing", "Zamanlama"],
  ["message", "Mesaj"],
];

const CREATOR_FIELD_LABELS: Array<[string, string]> = [
  ["email", "E-posta"],
  ["phone", "Telefon"],
  ["tiktokUrl", "TikTok"],
  ["instagramUrl", "Instagram"],
  ["category", "İçerik kategorisi"],
  ["followerRange", "Takipçi aralığı"],
  ["city", "Şehir"],
  ["bio", "Kısa tanıtım"],
];

/**
 * Payload rendered as labelled rows, in a fixed order.
 *
 * Known fields come first with Turkish labels; anything the marketing site adds
 * later still shows up, under its raw key, rather than disappearing silently.
 */
export function describeLeadFields(
  kind: LeadKind,
  payload: Record<string, unknown>
): Array<{ key: string; label: string; value: string }> {
  const known = kind === "brand_inquiry" ? BRAND_FIELD_LABELS : CREATOR_FIELD_LABELS;
  const rows: Array<{ key: string; label: string; value: string }> = [];
  const seen = new Set<string>(["fullName"]);

  for (const [key, label] of known) {
    seen.add(key);
    const value = readText(payload, key);
    if (value.length > 0) {
      rows.push({ key, label, value });
    }
  }

  for (const [key, raw] of Object.entries(payload)) {
    if (seen.has(key)) {
      continue;
    }
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length > 0) {
      rows.push({ key, label: key, value });
    }
  }

  return rows;
}

/**
 * TikTok handle from a submitted profile or video URL.
 *
 * Returns null rather than guessing when the URL carries no `@handle` — a
 * shortlink (vm.tiktok.com) resolves to nothing without a network call, and a
 * fabricated username would create a creator nobody can sync.
 */
export function extractTikTokUsername(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const direct = trimmed.match(/^@?([A-Za-z0-9._]{1,100})$/);
  if (direct) {
    return direct[1].toLowerCase();
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "tiktok.com" && !host.endsWith(".tiktok.com")) {
    return null;
  }

  const handleSegment = url.pathname
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .find((segment) => segment.startsWith("@"));

  if (!handleSegment) {
    return null;
  }

  const username = handleSegment.slice(1).trim().toLowerCase();
  return /^[a-z0-9._]{1,100}$/.test(username) ? username : null;
}

const LEAD_KIND_LABELS: Record<LeadKind, string> = {
  brand_inquiry: "Marka talebi",
  creator_application: "Creator başvurusu",
};

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Yeni",
  contacted: "İletişime geçildi",
  qualified: "Değerlendirildi",
  archived: "Arşivlendi",
};

export function leadKindLabel(kind: LeadKind): string {
  return LEAD_KIND_LABELS[kind];
}

export function leadStatusLabel(status: LeadStatus): string {
  return LEAD_STATUS_LABELS[status];
}

export function emptyLeadStatusCounts(): Record<LeadStatus, number> {
  return { new: 0, contacted: 0, qualified: 0, archived: 0 };
}

export function countLeadsByStatus(
  leads: Array<{ status: LeadStatus }>
): Record<LeadStatus, number> {
  const counts = emptyLeadStatusCounts();
  for (const lead of leads) {
    counts[lead.status] += 1;
  }
  return counts;
}
