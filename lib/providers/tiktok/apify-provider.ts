import "server-only";

import {
  getServerEnv,
  getTikTokCreatorActorId,
  getTikTokSoundActorId,
  getTikTokVideoActorId,
} from "@/lib/env.server";
import {
  ApifyTikTokProvider,
  type ApifyFetchImpl,
} from "@/lib/providers/tiktok/apify-provider.core";
import type { TikTokProvider } from "@/lib/providers/tiktok/provider";

export { ApifyTikTokProvider, type ApifyFetchImpl };

export function createApifyTikTokProvider(): TikTokProvider {
  const env = getServerEnv();

  return new ApifyTikTokProvider(env.APIFY_API_TOKEN, env.APIFY_TIKTOK_ACTOR_ID, {
    videoActorId: getTikTokVideoActorId(),
    creatorActorId: getTikTokCreatorActorId(),
    soundActorId: getTikTokSoundActorId(),
  });
}
