/**
 * Recorded-shape fixtures for TikTok creator profile parsing.
 *
 * These mirror the field shapes real Apify TikTok actors return — especially
 * `clockworks~tiktok-scraper`, which emits video rows with authorMeta rather
 * than a dedicated profile object. Hand-written so no personal data or raw
 * provider payload is committed. No test in this suite performs a network call.
 */

/** Dedicated profile-scraper shape: flat fields, numeric statistics. */
export const completeCreatorItem = {
  id: "6745191554350268582",
  uniqueId: "ecemdans",
  nickname: "Ecem Dans",
  avatarLarger: "https://p16-sign-va.tiktokcdn.com/avatar-larger.jpeg",
  avatarThumb: "https://p16-sign-va.tiktokcdn.com/avatar-thumb.jpeg",
  signature: "Dans videoları · İstanbul",
  verified: true,
  followerCount: 84_500,
  followingCount: 312,
  heartCount: 1_240_000,
  videoCount: 197,
};

/** Same data delivered as formatted strings, as some actors do. */
export const numericStringCreatorItem = {
  uniqueId: "@ecemdans",
  nickname: "Ecem Dans",
  avatar: "https://p16-sign-va.tiktokcdn.com/avatar.jpeg",
  followerCount: "84,500",
  followingCount: "312",
  heartCount: "1 240 000",
  videoCount: "197",
  verified: "false",
};

/** European / compact count strings. */
export const compactAndGroupedCountItem = {
  uniqueId: "ecemdans",
  followerCount: "773.000",
  followingCount: "1,2K",
  heartCount: "1.2M",
  videoCount: "197",
};

/** Video-actor shape: identity and statistics nested under author objects. */
export const authorMetaCreatorItem = {
  authorMeta: {
    name: "ecemdans",
    nickName: "Ecem Dans",
    avatar: "https://p16-sign-va.tiktokcdn.com/author-meta-avatar.jpeg",
    signature: "Dans videoları",
    verified: false,
    fans: 84_500,
    following: 312,
    heart: 1_240_000,
    video: 197,
  },
};

/** Web API shape: identity under author, statistics under authorStats. */
export const authorStatsCreatorItem = {
  author: {
    uniqueId: "ecemdans",
    nickname: "Ecem Dans",
    avatarThumb: "https://p16-sign-va.tiktokcdn.com/author-avatar.jpeg",
    signature: "Dans videoları",
    verified: false,
  },
  authorStats: {
    followerCount: 84_500,
    followingCount: 312,
    heartCount: 1_240_000,
    videoCount: 197,
  },
};

/**
 * Realistic clockworks~tiktok-scraper video row for a profile scrape.
 * Top-level diggCount/playCount are *video* engagement and must never become
 * creator totals. Creator stats live under authorMeta / authorStats.
 */
export const clockworksVideoRowForEcemdans = {
  id: "7301234567890123456",
  text: "Kampanya videosu #dans",
  createTimeISO: "2026-07-20T09:00:00.000Z",
  webVideoUrl: "https://www.tiktok.com/@ecemdans/video/7301234567890123456",
  diggCount: 1_250,
  shareCount: 80,
  playCount: 45_000,
  commentCount: 40,
  collectCount: 90,
  authorMeta: {
    id: "6745191554350268582",
    name: "ecemdans",
    nickName: "Ecem Dans",
    fans: 773_000,
    following: 312,
    heart: 12_400_000,
    video: 197,
    avatar: "https://p16-sign-va.tiktokcdn.com/author-meta-avatar.jpeg",
    signature: "Dans videoları",
    verified: false,
  },
  authorStats: {
    followerCount: 773_000,
    followingCount: 312,
    heartCount: 12_400_000,
    videoCount: 197,
  },
};

/** Another creator's video — must not be selected for @ecemdans. */
export const clockworksVideoRowForOtherCreator = {
  id: "7999999999999999999",
  text: "Başka hesabın videosu",
  webVideoUrl: "https://www.tiktok.com/@baskakullanici/video/7999999999999999999",
  diggCount: 99_999,
  playCount: 9_999_999,
  authorMeta: {
    name: "baskakullanici",
    nickName: "Başka Kullanıcı",
    fans: 12_000,
    heart: 50_000,
    video: 10,
  },
};

/**
 * Dataset where the matching creator is not first — reproduces the old bug of
 * trusting items[0].
 */
export const datasetMatchingCreatorLater = [
  clockworksVideoRowForOtherCreator,
  {
    ...clockworksVideoRowForEcemdans,
    id: "7301234567890123457",
  },
];

/** Dedicated profile row appearing after unrelated video rows. */
export const datasetProfileAfterVideos = [
  clockworksVideoRowForOtherCreator,
  completeCreatorItem,
];

/** Only the required identity and follower count are present. */
export const minimalCreatorItem = {
  uniqueId: "ecemdans",
  followerCount: 84_500,
};

/** Follower count missing entirely — must be rejected, never defaulted to 0. */
export const missingFollowerCountItem = {
  uniqueId: "ecemdans",
  nickname: "Ecem Dans",
  followingCount: 312,
  heartCount: 1_240_000,
};

/** Video row whose authorMeta has no fans — required follower missing. */
export const videoRowMissingFollowers = {
  id: "7301234567890123456",
  diggCount: 1_250,
  playCount: 45_000,
  authorMeta: {
    name: "ecemdans",
    nickName: "Ecem Dans",
    heart: 12_400_000,
    video: 197,
  },
};

/** Malformed follower string that must not become a silent zero. */
export const malformedFollowerCountItem = {
  uniqueId: "ecemdans",
  followerCount: "7.6%",
};

/** No readable handle anywhere in the payload. */
export const missingIdentityItem = {
  nickname: "Ecem Dans",
  followerCount: 84_500,
};

/** Handle present but not expressible as a TikTok username. */
export const invalidIdentityItem = {
  uniqueId: "geçersiz kullanıcı!",
  followerCount: 84_500,
};

export const notFoundCreatorItem = {
  error: "User not found",
  uniqueId: "silinmis_hesap",
};

export const privateCreatorItem = {
  uniqueId: "gizli_hesap",
  privateAccount: true,
  followerCount: 1_200,
};

export const privateCreatorErrorItem = {
  errorMessage: "This account is private",
};

/** Provider resolved a different profile than the one requested. */
export const mismatchedCreatorItem = {
  uniqueId: "baskakullanici",
  nickname: "Başka Kullanıcı",
  followerCount: 12_000,
};

/** Negative counts are rejected (optional → null), not clamped to zero. */
export const negativeCountsCreatorItem = {
  uniqueId: "ecemdans",
  followerCount: 84_500,
  followingCount: -5,
  heartCount: -1,
  videoCount: -3,
};

/**
 * Sanitized Clockworks `AUTHOR_CACHE` profile row from a real SUCCEEDED run
 * that logged “Scraped 1/1 profiles” while the default dataset stayed empty
 * (`numParsed: 0`). Keys only — no bio text, cookies, or signed URLs.
 */
export const clockworksAuthorCacheProfile = {
  id: "7123456789012345678",
  name: "yarenniiom",
  profileUrl: "https://www.tiktok.com/@yarenniiom",
  nickName: "Yaren",
  verified: false,
  signature: "sample bio",
  avatar: "https://p16-sign-va.tiktokcdn.com/author-cache-avatar.jpeg",
  privateAccount: false,
  ttSeller: false,
  following: 120,
  friends: 40,
  fans: 15_400,
  heart: 220_000,
  video: 48,
  digg: 900,
  originalAvatarUrl: "https://p16-sign-va.tiktokcdn.com/author-cache-original.jpeg",
};

/** KV map shape used by clockworks~tiktok-scraper. */
export const clockworksAuthorCacheMap = {
  yarenniiom: clockworksAuthorCacheProfile,
};

/** Dataset row wrapping profiles[] (alternate actor packaging). */
export const wrappedProfilesDatasetRow = {
  profiles: [completeCreatorItem],
};

/** Non-empty row with no recognizable creator identity/stats shape. */
export const unsupportedCreatorShapeItem = {
  widget: "banner",
  layout: { columns: 2 },
  metrics: { clicks: 12 },
};
