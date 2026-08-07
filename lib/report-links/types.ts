import type { Platform } from "@/lib/types";

export type { Platform };

/** A URL that passed protocol and host validation. */
export type SafeExternalUrl = string;

export type ReportLinkKind = "profile" | "video";

/**
 * Everything a report link component needs. `null` means "no safe URL", which
 * renders plain non-clickable content rather than a dead action.
 */
export type ReportLink = {
  href: SafeExternalUrl;
  kind: ReportLinkKind;
  platform: Platform;
  /** Turkish accessible label, e.g. "@user profilini aç". */
  label: string;
};

export type ReportLinkOrNull = ReportLink | null;

/** Where a profile URL came from — useful for management-side diagnostics. */
export type ProfileUrlSource = "stored" | "derived" | "none";

export type ResolvedProfileUrl = {
  href: SafeExternalUrl | null;
  source: ProfileUrlSource;
};
