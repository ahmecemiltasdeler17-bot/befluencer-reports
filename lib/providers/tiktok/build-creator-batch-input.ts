import {
  assertApprovedTikTokProfile,
  buildTikTokProfileUrl,
  normalizeTikTokUsername,
} from "@/lib/providers/tiktok/profile-url";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";

export type CreatorBatchInputRow = {
  username: string;
  profileUrl: string;
};

/**
 * Clockworks-compatible multi-creator actor input.
 * One call → one actor run. Never build this from a single-username helper in a loop.
 */
export type CreatorActorBatchInput = {
  profiles: string[];
  startUrls: Array<{ url: string }>;
  profileScrapeSections: ["videos"];
  profileSorting: "latest";
  resultsPerPage: 1;
  excludePinnedPosts: true;
  searchQueries: [];
  shouldDownloadCovers: false;
  shouldDownloadVideos: false;
  shouldDownloadSubtitles: false;
  shouldDownloadSlideshowImages: false;
  shouldDownloadAvatars: false;
  shouldDownloadMusicCovers: false;
};

/**
 * Canonicalize + dedupe usernames, then build ONE actor input object
 * with profiles[] and startUrls[] of equal length.
 */
export function buildCreatorBatchInput(
  usernames: string[]
): {
  prepared: CreatorBatchInputRow[];
  input: CreatorActorBatchInput;
} {
  const prepared: CreatorBatchInputRow[] = [];
  const seen = new Set<string>();

  for (const raw of usernames) {
    try {
      const { username, profileUrl } = assertApprovedTikTokProfile({
        username: raw,
      });
      const key = normalizeTikTokUsername(username);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      prepared.push({
        username: key,
        profileUrl: profileUrl || buildTikTokProfileUrl(key),
      });
    } catch {
      // Skip invalid here — callers that need per-row errors should validate first.
      continue;
    }
  }

  if (prepared.length === 0) {
    throw new TikTokProviderError(
      "invalid_username",
      "Toplu profil senkronizasyonu için geçerli kullanıcı adı yok."
    );
  }

  const input: CreatorActorBatchInput = {
    profiles: prepared.map((row) => row.username),
    startUrls: prepared.map((row) => ({ url: row.profileUrl })),
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    resultsPerPage: 1,
    excludePinnedPosts: true,
    searchQueries: [],
    shouldDownloadCovers: false,
    shouldDownloadVideos: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
  };

  if (
    input.profiles.length !== prepared.length ||
    input.startUrls.length !== prepared.length
  ) {
    throw new Error(
      `Creator batch input collapsed: prepared=${prepared.length} profiles=${input.profiles.length} startUrls=${input.startUrls.length}`
    );
  }

  return { prepared, input };
}

/**
 * Hard check immediately before Apify actor-start POST.
 * Throws when a multi-creator batch silently collapses to one (or mismatched) entry.
 */
export function assertCreatorBatchInputIntact(
  input: Record<string, unknown>,
  expectedBatchSize: number
): void {
  if (expectedBatchSize <= 1) {
    return;
  }

  const profiles = Array.isArray(input.profiles) ? input.profiles : null;
  const startUrls = Array.isArray(input.startUrls) ? input.startUrls : null;

  if (!profiles || profiles.length !== expectedBatchSize) {
    throw new Error(
      `Creator batch collapsed before Apify start: expected profiles=${expectedBatchSize}, got=${profiles?.length ?? 0}`
    );
  }

  if (!startUrls || startUrls.length !== expectedBatchSize) {
    throw new Error(
      `Creator batch collapsed before Apify start: expected startUrls=${expectedBatchSize}, got=${startUrls?.length ?? 0}`
    );
  }
}
