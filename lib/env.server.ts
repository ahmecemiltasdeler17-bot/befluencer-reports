import "server-only";

import { z } from "zod";

import {
  isValidConfiguredOrigin,
  resolveAppUrlCandidate,
  resolveMarketingSiteUrlCandidate,
  resolvePublicReportUrlCandidate,
} from "@/lib/origins";

const serverEnvSchema = z.object({
  APIFY_API_TOKEN: z
    .string({ error: "APIFY_API_TOKEN is required for TikTok sync." })
    .min(1, "APIFY_API_TOKEN cannot be empty."),
  APIFY_TIKTOK_ACTOR_ID: z
    .string({ error: "APIFY_TIKTOK_ACTOR_ID is required for TikTok sync." })
    .min(1, "APIFY_TIKTOK_ACTOR_ID cannot be empty."),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function formatEnvErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "environment";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

let cachedServerEnv: ServerEnv | null = null;

/**
 * Validates server-only environment variables for TikTok sync.
 * Must only be imported from server-side modules.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const parsed = serverEnvSchema.safeParse({
    APIFY_API_TOKEN: process.env.APIFY_API_TOKEN,
    APIFY_TIKTOK_ACTOR_ID: process.env.APIFY_TIKTOK_ACTOR_ID,
  });

  if (!parsed.success) {
    const details = formatEnvErrors(parsed.error);
    throw new Error(
      [
        "BeFluencer Reports — TikTok sync configuration is invalid.",
        "",
        "Add the following server-only variables to .env.local:",
        "  APIFY_API_TOKEN=your-apify-token",
        "  APIFY_TIKTOK_ACTOR_ID=your-actor-id",
        "",
        "Validation errors:",
        details,
      ].join("\n")
    );
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export function isTikTokSyncConfigured(): boolean {
  return serverEnvSchema.safeParse({
    APIFY_API_TOKEN: process.env.APIFY_API_TOKEN,
    APIFY_TIKTOK_ACTOR_ID: process.env.APIFY_TIKTOK_ACTOR_ID,
  }).success;
}

/**
 * Optional dedicated actor for direct video URL metric fetch.
 * Falls back to `APIFY_TIKTOK_ACTOR_ID` when unset — no migration required.
 */
export function getTikTokVideoActorId(): string | null {
  return process.env.APIFY_TIKTOK_VIDEO_ACTOR_ID?.trim() || null;
}

/**
 * Optional dedicated actor for creator profile scraping.
 *
 * Creator sync reuses `APIFY_TIKTOK_ACTOR_ID` by default, because most TikTok
 * actors accept profile input and return author statistics. Set this only when
 * the configured video actor cannot scrape profiles.
 */
export function getTikTokCreatorActorId(): string | null {
  return process.env.APIFY_TIKTOK_CREATOR_ACTOR_ID?.trim() || null;
}

/**
 * Creator sync needs the same credentials as video sync; the creator actor is
 * additive. Kept as its own predicate so the UI can explain precisely what is
 * missing before an action is invoked.
 */
export function isTikTokCreatorSyncConfigured(): boolean {
  return isTikTokSyncConfigured();
}

/**
 * Optional dedicated actor for TikTok sound / music usage scraping
 * (e.g. `clockworks/tiktok-sound-scraper`). When unset, sound sync reuses
 * `APIFY_TIKTOK_ACTOR_ID` with a `musics` input.
 */
export function getTikTokSoundActorId(): string | null {
  return process.env.APIFY_TIKTOK_SOUND_ACTOR_ID?.trim() || null;
}

/**
 * Sound sync needs the same Apify credentials as video sync. A dedicated sound
 * actor is optional and additive.
 */
export function isTikTokSoundSyncConfigured(): boolean {
  return isTikTokSyncConfigured();
}

/**
 * Vercel Cron shared secret. Compared against `Authorization: Bearer …`.
 * Never expose via NEXT_PUBLIC_*.
 */
export function getCronSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || null;
}

export function isCronConfigured(): boolean {
  return Boolean(getCronSecret());
}

/**
 * Scheduled sync needs Apify + service-role (no browser session).
 * The public cron route additionally requires CRON_SECRET.
 */
export function isScheduledSyncConfigured(): boolean {
  return (
    isTikTokSyncConfigured() &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
  );
}

/**
 * Platform origin + PDF export configuration.
 *
 * APP_URL — internal management origin (print routes, admin absolute URLs).
 * PUBLIC_REPORT_URL — public share origin; falls back to APP_URL when unset.
 * MARKETING_SITE_URL — future corporate site; optional.
 *
 * Never derive these from Host / X-Forwarded-Host.
 *
 * CHROME_EXECUTABLE_PATH is always optional: on Vercel the bundled Chromium is
 * used instead, and locally an installed Chrome or Edge is auto-detected.
 */
const platformEnvSchema = z.object({
  APP_URL: z
    .string({ error: "APP_URL is required for PDF export and share URLs." })
    .refine(
      isValidConfiguredOrigin,
      "APP_URL must be an absolute http(s) origin (no path, query or credentials)."
    ),
  PUBLIC_REPORT_URL: z
    .string()
    .refine(
      isValidConfiguredOrigin,
      "PUBLIC_REPORT_URL must be an absolute http(s) origin."
    )
    .optional(),
  MARKETING_SITE_URL: z
    .string()
    .refine(
      isValidConfiguredOrigin,
      "MARKETING_SITE_URL must be an absolute http(s) origin."
    )
    .optional(),
  CHROME_EXECUTABLE_PATH: z.string().min(1).optional(),
});

export type PdfEnv = {
  APP_URL: string;
  CHROME_EXECUTABLE_PATH?: string;
};

export type PlatformEnv = {
  APP_URL: string;
  PUBLIC_REPORT_URL: string;
  MARKETING_SITE_URL?: string;
  CHROME_EXECUTABLE_PATH?: string;
};

function readPlatformEnvInput() {
  return {
    APP_URL: resolveAppUrlCandidate(),
    PUBLIC_REPORT_URL: resolvePublicReportUrlCandidate(),
    MARKETING_SITE_URL: resolveMarketingSiteUrlCandidate(),
    CHROME_EXECUTABLE_PATH:
      process.env.CHROME_EXECUTABLE_PATH?.trim() || undefined,
  };
}

function requirePlatformEnv(): PlatformEnv {
  const parsed = platformEnvSchema.safeParse(readPlatformEnvInput());

  if (!parsed.success) {
    throw new Error(
      [
        "BeFluencer Reports — platform / PDF configuration is invalid.",
        "",
        "Production (custom domains):",
        "  APP_URL=https://app.befluencer.co",
        "  PUBLIC_REPORT_URL=https://reports.befluencer.co",
        "",
        "Temporary (before DNS, same Vercel project):",
        "  APP_URL=https://befluencer-reports.vercel.app",
        "  PUBLIC_REPORT_URL=https://befluencer-reports.vercel.app",
        "",
        "Local .env.local:",
        "  APP_URL=http://localhost:3000",
        "  PUBLIC_REPORT_URL=http://localhost:3000",
        "  # optional:",
        "  # MARKETING_SITE_URL=http://localhost:3001",
        "  # CHROME_EXECUTABLE_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "",
        "Do not set Production APP_URL/PUBLIC_REPORT_URL to localhost.",
        "Validation errors:",
        formatEnvErrors(parsed.error),
      ].join("\n")
    );
  }

  return {
    APP_URL: parsed.data.APP_URL,
    PUBLIC_REPORT_URL: parsed.data.PUBLIC_REPORT_URL ?? parsed.data.APP_URL,
    MARKETING_SITE_URL: parsed.data.MARKETING_SITE_URL,
    CHROME_EXECUTABLE_PATH: parsed.data.CHROME_EXECUTABLE_PATH,
  };
}

export function getPdfEnv(): PdfEnv {
  const env = requirePlatformEnv();
  return {
    APP_URL: env.APP_URL,
    CHROME_EXECUTABLE_PATH: env.CHROME_EXECUTABLE_PATH,
  };
}

export function isPdfExportConfigured(): boolean {
  return platformEnvSchema.safeParse(readPlatformEnvInput()).success;
}

export function getPlatformEnv(): PlatformEnv {
  return requirePlatformEnv();
}
