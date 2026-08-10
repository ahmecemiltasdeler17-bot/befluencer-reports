import {
  chunkArray,
  dedupePreserveOrder,
} from "@/lib/providers/tiktok/sync-eligibility";
import { CREATOR_BATCH_SIZE } from "@/lib/providers/tiktok/sync-policy";
import { normalizeTikTokUsername } from "@/lib/providers/tiktok/profile-url";
import type {
  FetchCreatorProfileInput,
  TikTokCreatorBatchFetchResult,
  TikTokCreatorBatchItemResult,
} from "@/lib/providers/tiktok/types";

export type CreatorBatchFetchFn = (
  inputs: FetchCreatorProfileInput[]
) => Promise<TikTokCreatorBatchFetchResult>;

export type OrchestrateCreatorBatchesResult = {
  /** Per-username results after all batches. */
  results: Map<string, TikTokCreatorBatchItemResult>;
  /** Real actor-start counts summed from provider batch calls. */
  actorRunsStarted: number;
  /** Username lists actually sent to each provider batch call (for tests). */
  sentBatches: string[][];
};

/**
 * Production batch orchestrator for creator Apify runs.
 *
 * Guarantees:
 * - usernames are canonicalized + deduped first
 * - each provider call receives up to CREATOR_BATCH_SIZE usernames
 * - never calls the provider once-per-creator
 * - never builds single-creator inputs in a loop
 */
export async function orchestrateCreatorBatchFetches(
  usernames: string[],
  fetchBatch: CreatorBatchFetchFn
): Promise<OrchestrateCreatorBatchesResult> {
  const canonical: string[] = [];
  for (const raw of usernames) {
    try {
      canonical.push(normalizeTikTokUsername(raw));
    } catch {
      // Invalid usernames are skipped at this layer; callers handle failures.
    }
  }

  const unique = dedupePreserveOrder(canonical);
  const chunks = chunkArray(unique, CREATOR_BATCH_SIZE);
  const results = new Map<string, TikTokCreatorBatchItemResult>();
  const sentBatches: string[][] = [];
  let actorRunsStarted = 0;

  // Sequential batches — bounded concurrency of actor starts is handled by
  // the caller when running multiple independent orchestrations. Within one
  // orchestration we keep order simple and prove N→1 input construction.
  for (const chunk of chunks) {
    if (chunk.length === 0) {
      continue;
    }

    sentBatches.push([...chunk]);
    const batchResult = await fetchBatch(
      chunk.map((username) => ({ username }))
    );
    actorRunsStarted += batchResult.actorRunsStarted;

    for (const [username, item] of batchResult.results) {
      results.set(username, item);
    }
  }

  return { results, actorRunsStarted, sentBatches };
}
