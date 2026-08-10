/**
 * Safe local verification of Apify batch actor starts.
 *
 * Usage:
 *   npx tsx scripts/apify-batch-check.ts --videos url1,url2
 *   npx tsx scripts/apify-batch-check.ts --creators user1,user2
 *
 * Or env:
 *   APIFY_BATCH_CHECK_VIDEOS=url1,url2
 *   APIFY_BATCH_CHECK_CREATORS=user1,user2
 *
 * Prints only: requested entities, actor runs started, returned entities, duration.
 * Never prints tokens or raw payloads.
 */

import {
  getServerEnv,
  getTikTokCreatorActorId,
  getTikTokVideoActorId,
} from "../lib/env.server";
import { ApifyTikTokProvider } from "../lib/providers/tiktok/apify-provider.core";
import { ApifyRunTracker } from "../lib/providers/tiktok/apify-run-tracker";

function parseList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main() {
  const videos = parseList(
    readArg("--videos") ?? process.env.APIFY_BATCH_CHECK_VIDEOS
  );
  const creators = parseList(
    readArg("--creators") ?? process.env.APIFY_BATCH_CHECK_CREATORS
  );

  if (videos.length === 0 && creators.length === 0) {
    console.error(
      [
        "Usage:",
        "  npx tsx scripts/apify-batch-check.ts --videos url1,url2",
        "  npx tsx scripts/apify-batch-check.ts --creators user1,user2",
        "",
        "Or set APIFY_BATCH_CHECK_VIDEOS / APIFY_BATCH_CHECK_CREATORS.",
      ].join("\n")
    );
    process.exit(1);
  }

  const env = getServerEnv();
  const tracker = new ApifyRunTracker();
  const provider = new ApifyTikTokProvider(
    env.APIFY_API_TOKEN,
    env.APIFY_TIKTOK_ACTOR_ID,
    {
      videoActorId: getTikTokVideoActorId(),
      creatorActorId: getTikTokCreatorActorId(),
      runTracker: tracker,
    }
  );

  const startedAt = Date.now();
  let requested = 0;
  let returned = 0;

  if (videos.length > 0) {
    requested += videos.length;
    const batch = await provider.fetchVideoMetricsBatch(
      videos.map((videoUrl) => ({ videoUrl }))
    );
    for (const item of batch.results.values()) {
      if (item.status === "ok") {
        returned += 1;
      }
    }
  }

  if (creators.length > 0) {
    requested += creators.length;
    const batch = await provider.fetchCreatorProfilesBatch(
      creators.map((username) => ({ username }))
    );
    for (const item of batch.results.values()) {
      if (item.status === "ok") {
        returned += 1;
      }
    }
  }

  const durationMs = Date.now() - startedAt;

  console.log(
    JSON.stringify(
      {
        requestedEntities: requested,
        actorRunsStarted: tracker.actorRunsStarted,
        returnedEntities: returned,
        durationMs,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Batch check failed.";
  console.error(message);
  process.exit(1);
});
