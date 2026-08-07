/** Shared PDF export limits. Kept free of server-only imports so tests can use them. */

/** Token lifetime. The database also caps this at 5 minutes. */
export const EXPORT_TOKEN_TTL_SECONDS = 120;
export const EXPORT_TOKEN_MAX_TTL_SECONDS = 300;
export const EXPORT_TOKEN_BYTES = 32;

/** Bounded waits — a broken remote image must never hang an export. */
export const PRINT_NAVIGATION_TIMEOUT_MS = 30_000;
export const PRINT_READY_TIMEOUT_MS = 20_000;
export const PRINT_ASSET_TIMEOUT_MS = 8_000;
export const PDF_RENDER_TIMEOUT_MS = 30_000;
export const PDF_TOTAL_TIMEOUT_MS = 60_000;

/** Sanity limit — a runaway render must not stream an unbounded response. */
export const PDF_MAX_BYTES = 25 * 1024 * 1024;

export const PDF_READY_ATTRIBUTE = "data-pdf-ready";
export const PDF_READY_SELECTOR = '[data-pdf-ready="true"]';

/** Viewport wide enough that the report keeps its desktop layout in print. */
export const PRINT_VIEWPORT = {
  width: 1240,
  height: 1754,
  deviceScaleFactor: 2,
} as const;

export const PDF_PAGE_OPTIONS = {
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  landscape: false,
  scale: 0.68,
  margin: {
    top: "14mm",
    right: "12mm",
    bottom: "16mm",
    left: "12mm",
  },
} as const;

export const PDF_FILENAME_FALLBACK_PREFIX = "befluencer-report";
export const PDF_FILENAME_MAX_LENGTH = 120;
