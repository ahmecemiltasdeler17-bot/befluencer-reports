import {
  PDF_FILENAME_FALLBACK_PREFIX,
  PDF_FILENAME_MAX_LENGTH,
} from "@/features/pdf/constants";

/** Turkish characters have no ASCII equivalent in NFD, so map them explicitly. */
const TURKISH_TRANSLITERATION: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  İ: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  Ç: "c",
  Ğ: "g",
  Ö: "o",
  Ş: "s",
  Ü: "u",
};

function transliterate(value: string): string {
  return value.replace(
    /[çğıİöşüÇĞÖŞÜ]/g,
    (char) => TURKISH_TRANSLITERATION[char] ?? char
  );
}

/**
 * Lowercase ASCII slug. Path separators, quotes and control characters are
 * removed so the value is always safe inside a Content-Disposition header.
 */
export function slugifyForFilename(value: string): string {
  return transliterate(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds a deterministic download filename, e.g.
 * `befluencer-midnight-drive-rpt-2026-0047-v2.pdf`.
 * Falls back to `befluencer-report-v2.pdf` when no usable parts remain.
 */
export function buildReportPdfFilename({
  campaignName,
  reportNumber,
  versionNumber,
}: {
  campaignName?: string | null;
  reportNumber?: string | null;
  versionNumber: number;
}): string {
  const safeVersion =
    Number.isFinite(versionNumber) && versionNumber >= 1
      ? Math.floor(versionNumber)
      : 1;
  const versionPart = `v${safeVersion}`;

  const parts = [
    "befluencer",
    slugifyForFilename(campaignName ?? ""),
    slugifyForFilename(reportNumber ?? ""),
  ].filter((part) => part.length > 0);

  if (parts.length <= 1) {
    return `${PDF_FILENAME_FALLBACK_PREFIX}-${versionPart}.pdf`;
  }

  const suffix = `-${versionPart}.pdf`;
  const base = parts.join("-").slice(0, PDF_FILENAME_MAX_LENGTH - suffix.length);
  const trimmed = base.replace(/-+$/, "");

  if (trimmed.length === 0) {
    return `${PDF_FILENAME_FALLBACK_PREFIX}-${versionPart}.pdf`;
  }

  return `${trimmed}${suffix}`;
}

/** ASCII-only Content-Disposition value. */
export function buildContentDisposition(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  return `attachment; filename="${safe}"`;
}
