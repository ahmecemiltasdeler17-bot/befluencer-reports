import { detectUnavailableCreatorItem } from "@/lib/providers/tiktok/detect-unavailable-creator";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import { readFirstProviderCount } from "@/lib/providers/tiktok/parse-provider-count";
import {
  buildTikTokProfileUrl,
  normalizeTikTokUsername,
  usernamesMatch,
} from "@/lib/providers/tiktok/profile-url";
import type { TikTokCreatorProfile } from "@/lib/providers/tiktok/types";
import { unwrapApifyCreatorItems } from "@/lib/providers/tiktok/unwrap-apify-creator-items";

type UnknownRecord = Record<string, unknown>;

export type CreatorCandidateKind =
  | "dedicated_profile"
  | "top_level_creator"
  | "video_author";

export type SelectedCreatorCandidate = {
  index: number;
  kind: CreatorCandidateKind;
  item: UnknownRecord;
  username: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readFirstString(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const value = readString(candidate);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readBoolean(candidates: unknown[]): boolean | null {
  for (const candidate of candidates) {
    if (typeof candidate === "boolean") {
      return candidate;
    }

    if (candidate === "true") return true;
    if (candidate === "false") return false;
  }

  return null;
}

function nested(item: UnknownRecord, key: string): UnknownRecord | null {
  const value = item[key];
  return isRecord(value) ? value : null;
}

/**
 * Sanitized diagnostics. Never includes tokens, raw payloads, cookies,
 * signatures or URL query strings.
 *
 * - Always (non-test): on failure, log error code + requested username +
 *   dataset size + selected candidate type.
 * - Opt-in verbose shape dump: set TIKTOK_CREATOR_SYNC_DEBUG=1 in development.
 */
export function logCreatorDatasetDiagnostics(input: {
  requestedUsername: string;
  items: unknown[];
  selected: SelectedCreatorCandidate | null;
  errorCode?: string;
}): void {
  // node:test sets NODE_TEST; keep the suite quiet.
  if (process.env.NODE_TEST === "1") {
    return;
  }

  if (input.errorCode) {
    console.error("[tiktok-creator-sync]", {
      code: input.errorCode,
      requestedUsername: input.requestedUsername,
      datasetItemCount: input.items.length,
      selectedCandidateType: input.selected?.kind ?? null,
    });
  }

  if (
    process.env.TIKTOK_CREATOR_SYNC_DEBUG !== "1" ||
    process.env.NODE_ENV === "production"
  ) {
    return;
  }

  const candidates = input.items.map((item, index) => {
    if (!isRecord(item)) {
      return { index, kind: "non_object" as const };
    }

    return {
      index,
      topLevelKeys: Object.keys(item).slice(0, 40),
      hasAuthorMeta: isRecord(item.authorMeta),
      hasAuthor: isRecord(item.author),
      hasAuthorStats: isRecord(item.authorStats),
      hasFollowerCount: item.followerCount !== undefined,
      hasFans: item.fans !== undefined,
      hasUniqueId: item.uniqueId !== undefined,
      hasUsername: item.username !== undefined,
      itemType: readString(item.itemType) ?? readString(item.type),
      parsedUsername: tryReadUsername(item),
      classifiedAs: classifyCreatorItem(item),
    };
  });

  console.info("[tiktok-creator-sync:debug]", {
    requestedUsername: input.requestedUsername,
    datasetItemCount: input.items.length,
    selectedIndex: input.selected?.index ?? null,
    selectedKind: input.selected?.kind ?? null,
    selectedUsername: input.selected?.username ?? null,
    errorCode: input.errorCode ?? null,
    candidates,
  });
}

function tryNormalizeUsername(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  try {
    return normalizeTikTokUsername(raw);
  } catch {
    return null;
  }
}

/**
 * Dedicated profile identity — top-level or nested user object, not a video
 * author's nested meta alone.
 */
function readDedicatedProfileUsername(item: UnknownRecord): string | null {
  const userInfo = nested(item, "userInfo");
  const user = userInfo ? nested(userInfo, "user") : nested(item, "user");

  return tryNormalizeUsername(
    readFirstString([
      item.uniqueId,
      item.username,
      item.name,
      user?.uniqueId,
      user?.username,
    ])
  );
}

/** Video-author identity paths only. */
function readVideoAuthorUsername(item: UnknownRecord): string | null {
  const authorMeta = nested(item, "authorMeta");
  const author = nested(item, "author");

  return tryNormalizeUsername(
    readFirstString([
      authorMeta?.name,
      authorMeta?.uniqueId,
      author?.uniqueId,
      author?.username,
    ])
  );
}

/** Any identity path used for matching during candidate selection. */
function tryReadUsername(item: UnknownRecord): string | null {
  return (
    readDedicatedProfileUsername(item) ??
    readVideoAuthorUsername(item) ??
    tryNormalizeUsername(
      readFirstString([
        nested(item, "authorMeta")?.name,
        nested(item, "author")?.uniqueId,
      ])
    )
  );
}

function looksLikeVideoRow(item: UnknownRecord): boolean {
  const hasVideoUrl = Boolean(
    readString(item.webVideoUrl) ||
      readString(item.videoUrl) ||
      readString(item.url)
  );
  const hasVideoMetrics =
    item.playCount !== undefined ||
    item.diggCount !== undefined ||
    item.shareCount !== undefined ||
    item.commentCount !== undefined ||
    item.collectCount !== undefined;
  const hasVideoBody = Boolean(
    readString(item.text) ||
      readString(item.desc) ||
      nested(item, "videoMeta") ||
      nested(item, "video")
  );
  const type = (readString(item.itemType) ?? readString(item.type) ?? "").toLowerCase();

  if (type.includes("video") || type.includes("post")) {
    return true;
  }

  // A dedicated profile row may carry aggregate heartCount; video rows carry
  // diggCount + playCount together with author meta.
  return (hasVideoUrl || hasVideoBody) && hasVideoMetrics;
}

function hasTopLevelCreatorStats(item: UnknownRecord): boolean {
  return (
    item.followerCount !== undefined ||
    item.followers !== undefined ||
    item.fans !== undefined ||
    nested(item, "stats")?.followerCount !== undefined ||
    nested(item, "userStats")?.followerCount !== undefined ||
    nested(nested(item, "userInfo") ?? {}, "stats")?.followerCount !== undefined
  );
}

export function classifyCreatorItem(
  item: UnknownRecord
): CreatorCandidateKind | null {
  const dedicatedUsername = readDedicatedProfileUsername(item);
  const videoAuthorUsername = readVideoAuthorUsername(item);
  const isVideo = looksLikeVideoRow(item);

  if (dedicatedUsername && !isVideo && hasTopLevelCreatorStats(item)) {
    return "dedicated_profile";
  }

  if (dedicatedUsername && hasTopLevelCreatorStats(item) && !isVideo) {
    return "top_level_creator";
  }

  if (dedicatedUsername && hasTopLevelCreatorStats(item)) {
    // Profile-shaped row that also has incidental video-like keys.
    return "top_level_creator";
  }

  if (videoAuthorUsername && isVideo) {
    return "video_author";
  }

  if (videoAuthorUsername) {
    return "video_author";
  }

  if (dedicatedUsername) {
    return hasTopLevelCreatorStats(item)
      ? "top_level_creator"
      : "dedicated_profile";
  }

  return null;
}

/**
 * Picks the dataset item that actually describes the requested creator.
 *
 * Never trusts index 0. Never selects an item merely because it contains a
 * follower-like number.
 */
export function selectCreatorProfileCandidate(
  items: unknown[],
  requestedUsername: string
): SelectedCreatorCandidate {
  const requested = tryNormalizeUsername(requestedUsername);

  if (!requested) {
    throw new TikTokProviderError("invalid_username");
  }

  const ranked: SelectedCreatorCandidate[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (!isRecord(item)) {
      continue;
    }

    // Skip explicit unavailable rows during selection; the dataset parser still
    // surfaces not-found when every item is an error.
    if (detectUnavailableCreatorItem(item)) {
      continue;
    }

    const kind = classifyCreatorItem(item);
    const username =
      kind === "video_author"
        ? readVideoAuthorUsername(item)
        : readDedicatedProfileUsername(item) ?? readVideoAuthorUsername(item);

    if (!kind || !username || !usernamesMatch(username, requested)) {
      continue;
    }

    ranked.push({ index, kind, item, username });
  }

  const pick =
    ranked.find((entry) => entry.kind === "dedicated_profile") ??
    ranked.find((entry) => entry.kind === "top_level_creator") ??
    ranked.find((entry) => entry.kind === "video_author");

  if (!pick) {
    const anyRecognizedShape = items.some(
      (item) => isRecord(item) && classifyCreatorItem(item) !== null
    );

    if (!anyRecognizedShape) {
      throw new TikTokProviderError("unsupported_result");
    }

    throw new TikTokProviderError("username_mismatch");
  }

  return pick;
}

/**
 * Creator-level metric paths only. Video engagement fields (diggCount,
 * playCount, shareCount, commentCount, collectCount) are intentionally absent.
 */
function readFollowerCount(item: UnknownRecord): number | null {
  const authorStats = nested(item, "authorStats");
  const authorMeta = nested(item, "authorMeta");
  const userInfo = nested(item, "userInfo");
  const userStats = userInfo
    ? nested(userInfo, "stats")
    : nested(item, "userStats");
  const stats = nested(item, "stats");

  return readFirstProviderCount([
    authorStats?.followerCount,
    authorMeta?.fans,
    authorMeta?.followers,
    userStats?.followerCount,
    stats?.followerCount,
    item.followerCount,
    item.followers,
    item.fans,
  ]);
}

function readFollowingCount(item: UnknownRecord): number | null {
  const authorStats = nested(item, "authorStats");
  const authorMeta = nested(item, "authorMeta");
  const userInfo = nested(item, "userInfo");
  const userStats = userInfo
    ? nested(userInfo, "stats")
    : nested(item, "userStats");
  const stats = nested(item, "stats");

  return readFirstProviderCount([
    authorStats?.followingCount,
    authorMeta?.following,
    userStats?.followingCount,
    stats?.followingCount,
    item.followingCount,
    item.following,
  ]);
}

function readTotalLikes(item: UnknownRecord): number | null {
  const authorStats = nested(item, "authorStats");
  const authorMeta = nested(item, "authorMeta");
  const userInfo = nested(item, "userInfo");
  const userStats = userInfo
    ? nested(userInfo, "stats")
    : nested(item, "userStats");
  const stats = nested(item, "stats");

  // diggCount is deliberately omitted — on video rows it is post likes.
  return readFirstProviderCount([
    authorStats?.heartCount,
    authorStats?.heart,
    authorMeta?.heart,
    userStats?.heartCount,
    stats?.heartCount,
    item.heartCount,
    item.totalLikes,
    item.heart,
  ]);
}

function readVideoCount(item: UnknownRecord): number | null {
  const authorStats = nested(item, "authorStats");
  const authorMeta = nested(item, "authorMeta");
  const userInfo = nested(item, "userInfo");
  const userStats = userInfo
    ? nested(userInfo, "stats")
    : nested(item, "userStats");
  const stats = nested(item, "stats");

  return readFirstProviderCount([
    authorStats?.videoCount,
    authorMeta?.video,
    userStats?.videoCount,
    stats?.videoCount,
    item.videoCount,
    item.videos,
    // Clockworks AUTHOR_CACHE / authorMeta-flat profile rows.
    item.video,
  ]);
}

function readDisplayName(item: UnknownRecord): string | null {
  const authorMeta = nested(item, "authorMeta");
  const author = nested(item, "author");
  const userInfo = nested(item, "userInfo");
  const user = userInfo ? nested(userInfo, "user") : nested(item, "user");

  return readFirstString([
    item.nickname,
    item.nickName,
    item.displayName,
    authorMeta?.nickName,
    authorMeta?.nickname,
    author?.nickname,
    user?.nickname,
  ]);
}

function readAvatarUrl(item: UnknownRecord): string | null {
  const authorMeta = nested(item, "authorMeta");
  const author = nested(item, "author");
  const userInfo = nested(item, "userInfo");
  const user = userInfo ? nested(userInfo, "user") : nested(item, "user");

  return readFirstString([
    item.avatar,
    item.avatarUrl,
    item.avatarLarger,
    item.avatarMedium,
    item.avatarThumb,
    item.originalAvatarUrl,
    authorMeta?.avatar,
    author?.avatarLarger,
    author?.avatarThumb,
    user?.avatarLarger,
    user?.avatarThumb,
  ]);
}

function readBio(item: UnknownRecord): string | null {
  const authorMeta = nested(item, "authorMeta");
  const author = nested(item, "author");
  const userInfo = nested(item, "userInfo");
  const user = userInfo ? nested(userInfo, "user") : nested(item, "user");

  return readFirstString([
    item.signature,
    item.bio,
    authorMeta?.signature,
    author?.signature,
    user?.signature,
  ]);
}

function readVerified(item: UnknownRecord): boolean | null {
  const authorMeta = nested(item, "authorMeta");
  const author = nested(item, "author");
  const userInfo = nested(item, "userInfo");
  const user = userInfo ? nested(userInfo, "user") : nested(item, "user");

  return readBoolean([
    item.verified,
    authorMeta?.verified,
    author?.verified,
    user?.verified,
  ]);
}

/**
 * Normalizes one already-selected dataset item into a `TikTokCreatorProfile`.
 *
 * Optional fields that fail to parse become null and do not fail the sync.
 * A missing or invalid follower count fails the sync.
 */
export function parseApifyTikTokCreator(
  item: unknown,
  expectedUsername?: string
): TikTokCreatorProfile {
  if (!isRecord(item)) {
    throw new TikTokProviderError("malformed_result");
  }

  const unavailable = detectUnavailableCreatorItem(item);

  if (unavailable) {
    throw new TikTokProviderError(
      unavailable.code,
      undefined,
      unavailable.reason
    );
  }

  const rawUsername =
    readDedicatedProfileUsername(item) ?? readVideoAuthorUsername(item);

  if (!rawUsername) {
    throw new TikTokProviderError(
      "malformed_result",
      "TikTok veri sağlayıcı yanıtında kullanıcı adı bulunamadı."
    );
  }

  if (expectedUsername && !usernamesMatch(rawUsername, expectedUsername)) {
    throw new TikTokProviderError("username_mismatch");
  }

  const followerCount = readFollowerCount(item);

  if (followerCount === null) {
    throw new TikTokProviderError("follower_count_unavailable");
  }

  return {
    username: rawUsername,
    displayName: readDisplayName(item),
    // Always deterministic — a provider-supplied URL is never trusted verbatim.
    profileUrl: buildTikTokProfileUrl(rawUsername),
    avatarUrl: readAvatarUrl(item),
    followerCount,
    followingCount: readFollowingCount(item),
    totalLikes: readTotalLikes(item),
    videoCount: readVideoCount(item),
    bio: readBio(item),
    verified: readVerified(item),
  };
}

/**
 * Reads a creator profile out of an actor dataset.
 *
 * `clockworks~tiktok-scraper` typically returns video rows for a profile scrape.
 * The matching author is selected by identity; index 0 is never trusted.
 */
export function parseApifyTikTokCreatorDataset(
  items: unknown[],
  expectedUsername?: string
): TikTokCreatorProfile {
  const normalizedItems = unwrapApifyCreatorItems(items);

  if (normalizedItems.length === 0) {
    throw new TikTokProviderError(
      "empty_result",
      "TikTok sağlayıcısı bu profil için boş sonuç döndürdü."
    );
  }

  if (!expectedUsername) {
    // Without a requested identity there is no safe way to choose among rows.
    throw new TikTokProviderError("invalid_username");
  }

  // Prefer an explicit unavailable signal when the dataset is nothing but errors.
  const onlyUnavailable = normalizedItems.every(
    (item) => detectUnavailableCreatorItem(item) !== null
  );

  if (onlyUnavailable) {
    const first = detectUnavailableCreatorItem(normalizedItems[0]);
    if (first) {
      throw new TikTokProviderError(first.code, undefined, first.reason);
    }
  }

  let selected: SelectedCreatorCandidate | null = null;

  try {
    selected = selectCreatorProfileCandidate(
      normalizedItems,
      expectedUsername
    );
    const profile = parseApifyTikTokCreator(selected.item, expectedUsername);

    logCreatorDatasetDiagnostics({
      requestedUsername: expectedUsername,
      items: normalizedItems,
      selected,
    });

    return profile;
  } catch (error) {
    const errorCode =
      error instanceof TikTokProviderError ? error.code : "malformed_result";

    logCreatorDatasetDiagnostics({
      requestedUsername: expectedUsername,
      items: normalizedItems,
      selected,
      errorCode,
    });

    throw error;
  }
}
