import type {
  TikTokCreatorProvider,
  TikTokMetricsProvider,
  TikTokSoundProvider,
} from "@/lib/providers/tiktok/types";

/**
 * The full provider surface. Sync services depend on one of these interfaces,
 * never on the Apify implementation, so a provider swap touches only the
 * adapter and its parser.
 *
 * Capabilities are separate interfaces because they are independently useful:
 * video sync needs metrics, creator sync needs profiles, sound sync needs
 * sound usage, and a test double can implement exactly one of them.
 */
export interface TikTokProvider
  extends TikTokMetricsProvider,
    TikTokCreatorProvider,
    TikTokSoundProvider {}

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
