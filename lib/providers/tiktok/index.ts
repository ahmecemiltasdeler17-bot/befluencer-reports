export type {
  FetchCreatorProfileInput,
  FetchSoundProfileInput,
  TikTokCreatorProfile,
  TikTokCreatorProvider,
  TikTokMetricsProvider,
  TikTokSoundProfile,
  TikTokSoundProvider,
  TikTokVideoMetrics,
} from "@/lib/providers/tiktok/types";
export type { TikTokProvider } from "@/lib/providers/tiktok/provider";
export {
  mapActorTerminalStatus,
  mapHttpStatusToProviderError,
  readApifyErrorType,
  LOGIN_REQUIRED_CONTENT_DETAIL,
  TikTokProviderError,
  toTurkishProviderMessage,
  inferProviderErrorCodeFromUserMessage,
} from "@/lib/providers/tiktok/errors";
export {
  classifyEmptySucceededVideoRun,
  detectLoginRequiredFromDatasetItems,
  detectLoginRequiredFromLog,
} from "@/lib/providers/tiktok/detect-login-required";
export {
  detectUnavailableCreatorItem,
  isDefinitiveUnavailableCreatorError,
  unavailableReasonFromProviderError,
} from "@/lib/providers/tiktok/detect-unavailable-creator";
export {
  assertApprovedTikTokUrl,
  normalizeTikTokVideoUrl,
  type NormalizedTikTokUrl,
} from "@/lib/providers/tiktok/url";
export {
  assertApprovedTikTokProfile,
  buildTikTokProfileUrl,
  normalizeTikTokUsername,
  usernamesMatch,
  type NormalizedTikTokProfile,
} from "@/lib/providers/tiktok/profile-url";
export {
  assertApprovedTikTokSoundUrl,
  isTikTokSoundUrl,
  normalizeTikTokSoundUrl,
  parseTikTokSoundId,
  type NormalizedTikTokSoundUrl,
} from "@/lib/providers/tiktok/sound-url";
export {
  parseApifyTikTokDataset,
  parseApifyTikTokDatasetBatch,
  parseApifyTikTokItem,
} from "@/lib/providers/tiktok/parse-apify-item";
export {
  CREATOR_BATCH_SIZE,
  CREATOR_FRESHNESS_MS,
  MANUAL_SYNC_COOLDOWN_MS,
  PROVIDER_BATCH_CONCURRENCY,
  SOUND_FRESHNESS_MS,
  SYNC_UX_MESSAGES,
  VIDEO_BATCH_SIZE,
  VIDEO_FRESHNESS_MS,
} from "@/lib/providers/tiktok/sync-policy";
export {
  evaluateCreatorSyncEligibility,
  evaluateSoundSyncEligibility,
  evaluateVideoSyncEligibility,
  dedupePreserveOrder,
  chunkArray,
} from "@/lib/providers/tiktok/sync-eligibility";
export {
  classifyCreatorItem,
  parseApifyTikTokCreator,
  parseApifyTikTokCreatorDataset,
  selectCreatorProfileCandidate,
} from "@/lib/providers/tiktok/parse-apify-creator";
export {
  parseApifyTikTokSoundDataset,
  selectSoundProfileCandidate,
} from "@/lib/providers/tiktok/parse-apify-sound";
export { parseProviderCount } from "@/lib/providers/tiktok/parse-provider-count";
export {
  itemsFromApifyAuthorCache,
  unwrapApifyCreatorItems,
} from "@/lib/providers/tiktok/unwrap-apify-creator-items";

import "server-only";

export { ApifyTikTokProvider, createApifyTikTokProvider } from "@/lib/providers/tiktok/apify-provider";
