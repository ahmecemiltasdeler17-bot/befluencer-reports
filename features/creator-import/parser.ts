import {
  assertApprovedTikTokProfile,
  buildTikTokProfileUrl,
} from "@/lib/providers/tiktok/profile-url";

import {
  CREATOR_IMPORT_MAX_ROWS,
  CREATOR_IMPORT_MAX_TEXT_CHARS,
  type CreatorImportRow,
  type CreatorImportRowStatus,
  type CreatorImportTotals,
} from "@/features/creator-import/types";

const GOOGLE_REDIRECT_HOSTS = new Set([
  "www.google.com",
  "google.com",
  "www.google.com.tr",
  "google.com.tr",
]);

const MARKDOWN_LINK =
  /^\s*\[([^\]]*)\]\(\s*<?([^)\s>]+)>?\s*(?:["'][^"']*["'])?\s*\)\s*$/;

const FEE_OR_NOISE_HEADERS = new Set([
  "fee",
  "ucret",
  "ücret",
  "price",
  "fiyat",
  "notes",
  "notlar",
  "email",
  "phone",
  "telefon",
]);

const URL_HEADERS = [
  "url",
  "link",
  "profile",
  "profil",
  "tiktok",
  "profile_url",
  "profileurl",
  "profile link",
  "tiktok url",
  "tiktok link",
];

export type ParsedImportCandidate = {
  original: string;
  username: string;
  displayName: string;
  profileUrl: string;
};

export type ParseCreatorImportTextResult = {
  candidates: Array<
    | { original: string; ok: true; value: ParsedImportCandidate }
    | {
        original: string;
        ok: false;
        status: Extract<"invalid_link" | "username_unextracted", CreatorImportRowStatus>;
      }
  >;
  error?: string;
};

/**
 * Pure text/CSV parser. Never fetches URLs or calls a provider.
 */
export function parseCreatorImportText(input: string): ParseCreatorImportTextResult {
  if (typeof input !== "string") {
    return { candidates: [], error: "Geçersiz giriş." };
  }

  if (input.length > CREATOR_IMPORT_MAX_TEXT_CHARS) {
    return {
      candidates: [],
      error: `Metin çok büyük. En fazla ${CREATOR_IMPORT_MAX_TEXT_CHARS.toLocaleString("tr-TR")} karakter yapıştırılabilir.`,
    };
  }

  const lines = extractSourceLines(input);

  if (lines.length === 0) {
    return { candidates: [], error: "İçe aktarılacak satır bulunamadı." };
  }

  if (lines.length > CREATOR_IMPORT_MAX_ROWS) {
    return {
      candidates: [],
      error: `En fazla ${CREATOR_IMPORT_MAX_ROWS} satır içe aktarılabilir.`,
    };
  }

  const candidates: ParseCreatorImportTextResult["candidates"] = [];

  for (const original of lines) {
    const extracted = extractTikTokProfileCandidate(original);

    if (!extracted.ok) {
      candidates.push({
        original,
        ok: false,
        status: extracted.status,
      });
      continue;
    }

    candidates.push({
      original,
      ok: true,
      value: extracted.value,
    });
  }

  return { candidates };
}

/**
 * Builds preview rows: list-internal duplicates first, then mark existing
 * usernames supplied by the caller (case-insensitive).
 */
export function buildCreatorImportPreviewRows(
  parsed: ParseCreatorImportTextResult,
  existingUsernamesLower: ReadonlySet<string>
): { rows: CreatorImportRow[]; totals: CreatorImportTotals } {
  const seenInList = new Set<string>();
  const rows: CreatorImportRow[] = [];

  let ready = 0;
  let existing = 0;
  let duplicateInList = 0;
  let invalid = 0;

  parsed.candidates.forEach((candidate, index) => {
    const rowNumber = index + 1;

    if (!candidate.ok) {
      invalid += 1;
      rows.push({
        rowNumber,
        original: candidate.original,
        username: null,
        displayName: null,
        profileUrl: null,
        status: candidate.status,
      });
      return;
    }

    const usernameLower = candidate.value.username.toLowerCase();

    if (seenInList.has(usernameLower)) {
      duplicateInList += 1;
      rows.push({
        rowNumber,
        original: candidate.original,
        username: candidate.value.username,
        displayName: candidate.value.displayName,
        profileUrl: candidate.value.profileUrl,
        status: "duplicate_in_list",
      });
      return;
    }

    seenInList.add(usernameLower);

    if (existingUsernamesLower.has(usernameLower)) {
      existing += 1;
      rows.push({
        rowNumber,
        original: candidate.original,
        username: candidate.value.username,
        displayName: candidate.value.displayName,
        profileUrl: candidate.value.profileUrl,
        status: "existing",
      });
      return;
    }

    ready += 1;
    rows.push({
      rowNumber,
      original: candidate.original,
      username: candidate.value.username,
      displayName: candidate.value.displayName,
      profileUrl: candidate.value.profileUrl,
      status: "ready",
    });
  });

  return {
    rows,
    totals: {
      total: rows.length,
      ready,
      existing,
      duplicateInList,
      invalid,
    },
  };
}

export function extractTikTokProfileCandidate(rawLine: string):
  | { ok: true; value: ParsedImportCandidate }
  | {
      ok: false;
      status: Extract<"invalid_link" | "username_unextracted", CreatorImportRowStatus>;
    } {
  const original = rawLine.trim();
  if (!original) {
    return { ok: false, status: "username_unextracted" };
  }

  const unwrapped = unwrapMarkdownLink(original);
  const fromGoogle = unwrapGoogleRedirect(unwrapped);
  const withScheme = ensureHttpsScheme(fromGoogle ?? unwrapped);

  if (!withScheme) {
    return { ok: false, status: "invalid_link" };
  }

  if (isRejectedTikTokPath(withScheme)) {
    return { ok: false, status: "invalid_link" };
  }

  try {
    const normalized = assertApprovedTikTokProfile({ profileUrl: withScheme });
    // Match single-create path: store lowercase handles for unique (platform, username).
    const username = normalized.username.toLowerCase();
    const profileUrl = buildTikTokProfileUrl(username);

    return {
      ok: true,
      value: {
        original,
        username,
        displayName: username,
        profileUrl,
      },
    };
  } catch {
    if (looksLikeUrlish(withScheme) || looksLikeUrlish(original)) {
      return { ok: false, status: "invalid_link" };
    }
    return { ok: false, status: "username_unextracted" };
  }
}

function extractSourceLines(input: string): string[] {
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const rawLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rawLines.length === 0) {
    return [];
  }

  if (looksLikeCsv(rawLines)) {
    return extractCsvUrlLines(rawLines);
  }

  return rawLines;
}

function looksLikeCsv(lines: string[]): boolean {
  const first = lines[0] ?? "";
  if (!first.includes(",")) {
    return false;
  }

  const headers = splitCsvLine(first).map((h) => h.toLowerCase());
  return headers.some((header) =>
    URL_HEADERS.some((candidate) => header.includes(candidate))
  );
}

function extractCsvUrlLines(lines: string[]): string[] {
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  let urlIndex = headers.findIndex((header) =>
    URL_HEADERS.some((candidate) => header.includes(candidate))
  );

  if (urlIndex < 0) {
    urlIndex = headers.findIndex((header) => !FEE_OR_NOISE_HEADERS.has(header));
  }

  if (urlIndex < 0) {
    return lines.slice(1);
  }

  const values: string[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const cell = (cells[urlIndex] ?? "").trim();
    if (cell) {
      values.push(cell);
    }
  }

  return values;
}

/** Minimal CSV splitter — handles quoted commas; ignores unknown columns. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function unwrapMarkdownLink(value: string): string {
  const match = value.match(MARKDOWN_LINK);
  if (!match) {
    return value;
  }
  return (match[2] ?? value).trim();
}

/**
 * Pulls a TikTok profile URL from a Google redirect `q` parameter only.
 * Never fetches Google.
 */
export function unwrapGoogleRedirect(value: string): string | null {
  let parsed: URL;

  try {
    const withScheme = ensureHttpsScheme(value);
    if (!withScheme) {
      return null;
    }
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (!GOOGLE_REDIRECT_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }

  const q = parsed.searchParams.get("q");
  if (!q) {
    return null;
  }

  let decoded = q;
  try {
    decoded = decodeURIComponent(q);
  } catch {
    decoded = q;
  }

  const candidate = ensureHttpsScheme(decoded.trim());
  if (!candidate) {
    return null;
  }

  try {
    const inner = new URL(candidate);
    if (
      inner.hostname.toLowerCase() === "tiktok.com" ||
      inner.hostname.toLowerCase() === "www.tiktok.com" ||
      inner.hostname.toLowerCase() === "m.tiktok.com"
    ) {
      return candidate;
    }
  } catch {
    return null;
  }

  return null;
}

export function ensureHttpsScheme(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^(javascript|data|blob|file):/i.test(trimmed)) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^\/\//.test(trimmed)) {
    return null;
  }

  if (/^(www\.)?tiktok\.com\//i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, "")}`;
  }

  if (/^@?[A-Za-z0-9._]{1,24}$/.test(trimmed.replace(/^@+/, ""))) {
    // Bare handles are not accepted as stored profile URLs; require a link.
    return null;
  }

  return null;
}

function isRejectedTikTokPath(value: string): boolean {
  try {
    const parsed = new URL(value);
    const path = parsed.pathname.toLowerCase();
    if (path.includes("/video/")) return true;
    if (path.includes("/music/") || path.startsWith("/music")) return true;
    if (path.includes("/sound/")) return true;
    return false;
  } catch {
    return false;
  }
}

function looksLikeUrlish(value: string): boolean {
  return (
    /^https?:\/\//i.test(value) ||
    /^(www\.)?tiktok\.com\//i.test(value) ||
    /google\./i.test(value) ||
    MARKDOWN_LINK.test(value)
  );
}
