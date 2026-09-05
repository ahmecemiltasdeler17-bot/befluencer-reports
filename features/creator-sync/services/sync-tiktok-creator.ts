import "server-only";

import { revalidatePath } from "next/cache";

import type { CreatorSnapshotCandidate } from "@/features/creator-sync/calculations";
import { listCampaignIdsForCreator } from "@/features/creator-sync/queries";
import { orchestrateCreatorBatchFetches } from "@/features/creator-sync/services/orchestrate-creator-batches";
import {
  runCreatorSync,
  UUID_PATTERN,
  type CreatorSyncPatch,
  type CreatorSyncPort,
  type CreatorSyncRecord,
} from "@/features/creator-sync/services/creator-sync-core";
import type {
  CreatorMetricSnapshot,
  SyncCampaignCreatorsResult,
  SyncCreatorResult,
} from "@/features/creator-sync/types";
import type { SyncDbClient } from "@/features/sync/db-client";
import type { TikTokSyncOperationCache } from "@/features/sync/services/sync-tiktok-video";
import { isTikTokSyncConfigured } from "@/lib/env.server";
import {
  createApifyTikTokProvider,
  TikTokProviderError,
} from "@/lib/providers/tiktok";
import { normalizeTikTokUsername } from "@/lib/providers/tiktok/profile-url";
import { mirrorCreatorAvatar } from "@/lib/providers/tiktok/mirror-creator-avatar";
import { evaluateCreatorSyncEligibility } from "@/lib/providers/tiktok/sync-eligibility";
import { CREATOR_BATCH_SIZE, hasProviderStartBudget } from "@/lib/providers/tiktok/sync-policy";
import {
  createEmptySyncMetrics,
  formatSyncMetricsTurkish,
  logSyncMetrics,
} from "@/lib/providers/tiktok/sync-observability";
import type { TikTokCreatorProvider } from "@/lib/providers/tiktok/types";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>> | SyncDbClient;

export type SyncCreatorOptions = {
  client?: SyncDbClient;
  force?: boolean;
  manualCooldown?: boolean;
  operationCache?: import("@/features/sync/services/sync-tiktok-video").TikTokSyncOperationCache;
  deadlineMs?: number;
};

function mapSupabaseMutationError(message: string, code?: string): string {
  if (code === "23505" || message.toLowerCase().includes("duplicate")) {
    return "Takipçi kaydı zaman çakışması nedeniyle oluşturulamadı.";
  }

  if (message.toLowerCase().includes("permission denied")) {
    return "Bu işlem için yetkiniz yok.";
  }

  return "Senkronizasyon kaydedilemedi.";
}

async function requireAuthenticatedClient(): Promise<SupabaseClient> {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  return supabase;
}

async function resolveClient(
  options?: SyncCreatorOptions
): Promise<SupabaseClient> {
  return options?.client ?? (await requireAuthenticatedClient());
}

function resolveProvider(
  provider?: TikTokCreatorProvider
): TikTokCreatorProvider {
  if (provider) {
    return provider;
  }

  if (!isTikTokSyncConfigured()) {
    throw new TikTokProviderError("not_configured");
  }

  return createApifyTikTokProvider();
}

/**
 * A creator is global, so a refreshed profile affects the creator screens and
 * every campaign it is assigned to, including each campaign's live report.
 * Generated report versions are immutable and are deliberately not revalidated.
 */
async function revalidateCreatorPaths(
  creatorId: string,
  client?: SyncDbClient
): Promise<void> {
  revalidatePath("/creators");
  revalidatePath(`/creators/${creatorId}`);

  for (const campaignId of await listCampaignIdsForCreator(creatorId, client)) {
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath(`/campaigns/${campaignId}/report`);
  }
}

/**
 * An embedded to-one relation is typed as an array when Supabase cannot infer
 * cardinality from a projected column list.
 */
function firstEmbedded<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }

  return (value as T | null) ?? null;
}

function createCreatorSyncPort(
  supabase: SupabaseClient,
  deadlineMs?: number,
  operationCache?: TikTokSyncOperationCache
): CreatorSyncPort {
  return {
    async loadCreator(creatorId): Promise<CreatorSyncRecord | null> {
      const { data, error } = await supabase
        .from("creators")
        .select(
          "id, platform, username, display_name, avatar_url, profile_url, follower_count, category, category_source, last_synced_at, sync_status, account_status, unavailable_reason, unavailable_at"
        )
        .eq("id", creatorId)
        .maybeSingle();

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }

      if (!data) {
        return null;
      }

      const categorySource =
        data.category_source === "manual" ? "manual" : "auto";

      return {
        id: data.id as string,
        platform: data.platform as string,
        username: data.username as string,
        displayName: (data.display_name as string | null) ?? null,
        avatarUrl: (data.avatar_url as string | null) ?? null,
        profileUrl: (data.profile_url as string | null) ?? null,
        followerCount: Number(data.follower_count),
        category: (data.category as CreatorSyncRecord["category"]) ?? null,
        categorySource,
        lastSyncedAt: (data.last_synced_at as string | null) ?? null,
        syncStatus: (data.sync_status as string | null) ?? null,
        accountStatus: (data.account_status as string | null) ?? "active",
      };
    },

    async createJob(creatorId, startedAt) {
      const { data, error } = await supabase
        .from("sync_jobs")
        .insert({
          creator_id: creatorId,
          job_type: "tiktok_creator_sync",
          status: "running",
          started_at: startedAt,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(mapSupabaseMutationError(error?.message ?? "", error?.code));
      }

      return data.id as string;
    },

    async getLatestSnapshot(creatorId) {
      const { data, error } = await supabase
        .from("creator_metric_snapshots")
        .select("*")
        .eq("creator_id", creatorId)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }

      if (!data) {
        return null;
      }

      const row = data as CreatorMetricSnapshot;

      return {
        ...row,
        follower_count: Number(row.follower_count),
        following_count:
          row.following_count === null ? null : Number(row.following_count),
        total_likes: row.total_likes === null ? null : Number(row.total_likes),
        video_count: row.video_count === null ? null : Number(row.video_count),
      };
    },

    async insertSnapshot(creatorId, snapshot) {
      const result = await insertSnapshotWithRetry(supabase, creatorId, snapshot);

      if (!result.ok) {
        throw new Error(result.message);
      }
    },

    async updateCreator(creatorId, patch: CreatorSyncPatch) {
      const { error } = await supabase
        .from("creators")
        .update(patch)
        .eq("id", creatorId);

      if (error) {
        throw new Error(mapSupabaseMutationError(error.message, error.code));
      }
    },

    async persistAvatar(creatorId, sourceUrl) {
      if (!("storage" in supabase)) return null;
      // Avatar caching is best-effort. Near the invocation deadline, preserve
      // the stored URL instead of starting another remote download.
      if (deadlineMs !== undefined && Date.now() >= deadlineMs - 30_000) {
        return null;
      }
      const publicUrl = await mirrorCreatorAvatar({
        creatorId,
        sourceUrl,
        storage: supabase.storage,
      });
      if (!publicUrl) {
        if (operationCache?.avatarMirrorFailures) {
          operationCache.avatarMirrorFailures.value += 1;
        }
        console.warn("[CreatorAvatarMirror]", {
          creatorId,
          sourceHost: new URL(sourceUrl).hostname,
          outcome: "preserved_existing",
        });
      }
      return publicUrl;
    },

    async markCreatorFailed(creatorId) {
      await supabase
        .from("creators")
        .update({ sync_status: "failed" })
        .eq("id", creatorId);
    },

    async markCreatorUnavailable(creatorId, reason, at) {
      await supabase
        .from("creators")
        .update({
          account_status: "unavailable",
          unavailable_reason: reason,
          unavailable_at: at,
          sync_status: "failed",
        })
        .eq("id", creatorId);
    },

    async completeJob(jobId, status, completedAt, errorMessage) {
      await supabase
        .from("sync_jobs")
        .update({ status, completed_at: completedAt, error_message: errorMessage })
        .eq("id", jobId);
    },

    async revalidate(creatorId) {
      await revalidateCreatorPaths(creatorId, supabase);
    },
  };
}

/**
 * Inserts a snapshot, retrying once with a one-second offset.
 * `unique (creator_id, captured_at)` can collide when two writes land inside the
 * same clock tick.
 */
async function insertSnapshotWithRetry(
  supabase: SupabaseClient,
  creatorId: string,
  snapshot: CreatorSnapshotCandidate
): Promise<{ ok: true } | { ok: false; message: string }> {
  const attemptInsert = (capturedAt: string) =>
    supabase.from("creator_metric_snapshots").insert({
      creator_id: creatorId,
      captured_at: capturedAt,
      follower_count: snapshot.followerCount,
      following_count: snapshot.followingCount,
      total_likes: snapshot.totalLikes,
      video_count: snapshot.videoCount,
    });

  let result = await attemptInsert(new Date().toISOString());

  if (result.error?.code === "23505") {
    result = await attemptInsert(new Date(Date.now() + 1000).toISOString());
  }

  if (result.error) {
    return {
      ok: false,
      message: mapSupabaseMutationError(result.error.message, result.error.code),
    };
  }

  return { ok: true };
}

/**
 * Refreshes one TikTok creator profile.
 *
 * Failure never destroys data: the previous follower count, display name and
 * avatar stay untouched and only `sync_status` becomes `failed`. Snapshots are
 * append-only and are never rewritten or removed by a sync.
 */
export async function syncTikTokCreator(
  creatorId: string,
  provider?: TikTokCreatorProvider,
  options?: SyncCreatorOptions
): Promise<SyncCreatorResult> {
  const supabase = await resolveClient(options);

  let creatorProvider: TikTokCreatorProvider;

  try {
    creatorProvider = resolveProvider(provider);
  } catch (error) {
    return {
      outcome: "failed",
      message:
        error instanceof TikTokProviderError
          ? error.toUserMessage()
          : "TikTok senkronizasyonu yapılandırılmamış.",
      snapshotCreated: false,
      followerCount: null,
      jobId: null,
    };
  }

  try {
    return await runCreatorSync(
      creatorId,
      creatorProvider,
      createCreatorSyncPort(
        supabase,
        options?.deadlineMs,
        options?.operationCache
      ),
      () => new Date(),
      {
        force: options?.force,
        manualCooldown: options?.manualCooldown ?? true,
      }
    );
  } catch (error) {
    // Reaching here means a port failed before a job row existed, so there is no
    // job to mark failed and no creator state to roll back.
    return {
      outcome: "failed",
      message:
        error instanceof Error ? error.message : "Senkronizasyon kaydedilemedi.",
      snapshotCreated: false,
      followerCount: null,
      jobId: null,
    };
  }
}

/**
 * Refreshes every TikTok creator assigned to a campaign.
 * Uses bounded creator batches (profiles[]) when the provider supports it.
 * Deduplicates creator ids and keeps going after an individual failure.
 */
export async function syncCampaignTikTokCreators(
  campaignId: string,
  provider?: TikTokCreatorProvider,
  options?: SyncCreatorOptions
): Promise<SyncCampaignCreatorsResult> {
  if (!UUID_PATTERN.test(campaignId)) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      unavailable: 0,
      message: "Geçersiz kampanya kimliği.",
    };
  }

  const supabase = await resolveClient(options);
  let creatorProvider: TikTokCreatorProvider;

  try {
    creatorProvider = resolveProvider(provider);
  } catch (error) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      unavailable: 0,
      message:
        error instanceof TikTokProviderError
          ? error.toUserMessage()
          : "TikTok senkronizasyonu yapılandırılmamış.",
    };
  }

  const { data: campaignExists } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaignExists) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      unavailable: 0,
      message: "Kampanya bulunamadı.",
    };
  }

  const { data: assignedRows, error: assignedError } = await supabase
    .from("campaign_creators")
    .select(
      "creator:creators (id, platform, username, last_synced_at, sync_status, account_status)"
    )
    .eq("campaign_id", campaignId);

  if (assignedError) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      unavailable: 0,
      message: mapSupabaseMutationError(assignedError.message, assignedError.code),
    };
  }

  const unique = new Map<
    string,
    {
      id: string;
      platform: string;
      username: string;
      lastSyncedAt: string | null;
      syncStatus: string | null;
      accountStatus: string | null;
    }
  >();

  for (const row of assignedRows ?? []) {
    const creator = firstEmbedded<{
      id: string;
      platform: string;
      username: string;
      last_synced_at: string | null;
      sync_status: string | null;
      account_status: string | null;
    }>(row.creator);
    if (creator && !unique.has(creator.id)) {
      unique.set(creator.id, {
        id: creator.id,
        platform: creator.platform,
        username: creator.username,
        lastSyncedAt: creator.last_synced_at,
        syncStatus: creator.sync_status,
        accountStatus: creator.account_status ?? "active",
      });
    }
  }

  const creatorIdsAll = [...unique.keys()];
  const latestSnapshotByCreatorId = new Map<string, string>();
  if (creatorIdsAll.length > 0) {
    const { data: snapshotRows } = await supabase
      .from("creator_metric_snapshots")
      .select("creator_id, captured_at")
      .in("creator_id", creatorIdsAll)
      .order("captured_at", { ascending: false });

    for (const row of snapshotRows ?? []) {
      const id = row.creator_id as string;
      if (!latestSnapshotByCreatorId.has(id)) {
        latestSnapshotByCreatorId.set(id, row.captured_at as string);
      }
    }
  }

  const metrics = createEmptySyncMetrics();
  const startedMs = Date.now();
  let skipped = 0;
  let unavailable = 0;
  const eligible: Array<{ id: string; username: string }> = [];

  for (const creator of unique.values()) {
    if (creator.platform !== "tiktok") {
      skipped += 1;
      continue;
    }
    const decision = evaluateCreatorSyncEligibility({
      lastSyncedAt: creator.lastSyncedAt,
      syncStatus: creator.syncStatus,
      latestSuccessfulSnapshotAt:
        latestSnapshotByCreatorId.get(creator.id) ?? null,
      accountStatus: creator.accountStatus,
      force: options?.force,
      manualCooldown: false,
    });
    if (!decision.eligible) {
      skipped += 1;
      if (decision.reason === "unavailable_account") {
        unavailable += 1;
        metrics.skippedUnavailable += 1;
      } else if (decision.reason === "non_retriable") {
        metrics.skippedNonRetriable += 1;
      } else {
        metrics.skippedFresh += 1;
      }
      continue;
    }
    eligible.push({ id: creator.id, username: creator.username });
  }

  // Deduplicate by normalized username within this campaign operation.
  const byUsername = new Map<string, string[]>();
  for (const item of eligible) {
    let key: string;
    try {
      key = normalizeTikTokUsername(item.username);
    } catch {
      metrics.failed += 1;
      const failingProvider: TikTokCreatorProvider = {
        async fetchCreatorProfile() {
          throw new TikTokProviderError("invalid_username");
        },
        async fetchCreatorProfilesBatch() {
          return { results: new Map(), actorRunsStarted: 0 };
        },
      };
      await syncTikTokCreator(item.id, failingProvider, {
        client: supabase,
        force: true,
        manualCooldown: false,
      });
      continue;
    }
    const list = byUsername.get(key) ?? [];
    list.push(item.id);
    byUsername.set(key, list);
  }

  const usernameKeys = [...byUsername.keys()];
  metrics.entitiesRequested = usernameKeys.length;
  const baselineRuns = usernameKeys.length;
  const operationCache = options?.operationCache;

  // Prefer cross-campaign cache (global sync prefetch). Only uncached
  // usernames hit Apify — and they go through orchestrateCreatorBatchFetches
  // so N usernames become ONE actor input, never N single-creator runs.
  const toFetch: string[] = [];
  const results = new Map<
    string,
    import("@/lib/providers/tiktok/types").TikTokCreatorBatchItemResult
  >();
  const deadlineSkipped = new Set<string>();

  for (const username of usernameKeys) {
    const cached = operationCache?.creatorResults.get(username);
    if (cached) {
      results.set(username, cached);
    } else {
      toFetch.push(username);
    }
  }

  if (toFetch.length > 0) {
    const orchestrated = await orchestrateCreatorBatchFetches(
      toFetch,
      (inputs) => creatorProvider.fetchCreatorProfilesBatch(inputs),
      { shouldContinue: () => hasProviderStartBudget(options?.deadlineMs) }
    );
    metrics.providerRunsStarted += orchestrated.actorRunsStarted;
    if (operationCache) {
      operationCache.actorRunsStarted.value += orchestrated.actorRunsStarted;
      if (operationCache.creatorActorRunsStarted) {
        operationCache.creatorActorRunsStarted.value += orchestrated.actorRunsStarted;
      }
    }
    for (const [username, item] of orchestrated.results) {
      results.set(username, item);
      operationCache?.creatorResults.set(username, item);
    }
    for (const username of orchestrated.skippedUsernames) {
      deadlineSkipped.add(username);
    }
  }

  for (const username of usernameKeys) {
    const item = results.get(username);
    const creatorIds = byUsername.get(username) ?? [];

    if (!item && deadlineSkipped.has(username)) {
      skipped += creatorIds.length;
      continue;
    }

    if (!item || item.status === "error") {
      const failingProvider: TikTokCreatorProvider = {
        async fetchCreatorProfile() {
          throw item?.status === "error"
            ? item.error
            : new TikTokProviderError("empty_result");
        },
        async fetchCreatorProfilesBatch() {
          return { results: new Map(), actorRunsStarted: 0 };
        },
      };
      for (const creatorId of creatorIds) {
        const result = await syncTikTokCreator(creatorId, failingProvider, {
          client: supabase,
          force: true,
          manualCooldown: false,
          deadlineMs: options?.deadlineMs,
        });
        if (result.outcome === "failed") {
          metrics.failed += 1;
        } else if (result.outcome === "success") {
          metrics.success += 1;
        } else if (result.outcome === "unavailable") {
          unavailable += 1;
          metrics.skippedUnavailable += 1;
        } else {
          skipped += 1;
        }
      }
      continue;
    }

    metrics.entitiesReturned += 1;
    const cachedProvider: TikTokCreatorProvider = {
      async fetchCreatorProfile() {
        return item.profile;
      },
      async fetchCreatorProfilesBatch() {
        return {
          results: new Map([
            [username, { status: "ok" as const, profile: item.profile }],
          ]),
          actorRunsStarted: 0,
        };
      },
    };

    for (const creatorId of creatorIds) {
      const result = await syncTikTokCreator(creatorId, cachedProvider, {
        client: supabase,
        force: true,
        manualCooldown: false,
        deadlineMs: options?.deadlineMs,
      });
      if (result.outcome === "success") {
        metrics.success += 1;
      } else if (result.outcome === "failed") {
        metrics.failed += 1;
      } else if (result.outcome === "unavailable") {
        unavailable += 1;
        metrics.skippedUnavailable += 1;
      } else {
        skipped += 1;
      }
    }
  }

  metrics.estimatedRunsSaved = Math.max(
    0,
    baselineRuns - metrics.providerRunsStarted
  );
  metrics.durationMs = Date.now() - startedMs;
  logSyncMetrics("sync_campaign_tiktok_creators", metrics);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/report`);
  revalidatePath("/creators");

  return {
    total: unique.size,
    success: metrics.success,
    failed: metrics.failed,
    skipped,
    unavailable,
    message: formatSyncMetricsTurkish(metrics),
  };
}

/**
 * Global sync: scrape every unique stale TikTok creator across campaigns
 * in bounded batches BEFORE per-campaign apply. Fills operationCache so
 * campaign sync does not start one-actor-per-creator runs.
 */
export async function prefetchCreatorBatchesForCampaigns(
  campaignIds: string[],
  operationCache: TikTokSyncOperationCache,
  options?: {
    client?: SyncDbClient;
    provider?: TikTokCreatorProvider;
    force?: boolean;
    deadlineMs?: number;
  }
): Promise<{ actorRunsStarted: number; usernamesFetched: number }> {
  if (campaignIds.length === 0) {
    return { actorRunsStarted: 0, usernamesFetched: 0 };
  }

  const supabase = await resolveClient(options);
  let creatorProvider: TikTokCreatorProvider;

  try {
    creatorProvider = resolveProvider(options?.provider);
  } catch {
    return { actorRunsStarted: 0, usernamesFetched: 0 };
  }

  const { data: assignedRows } = await supabase
    .from("campaign_creators")
    .select(
      "creator:creators (id, platform, username, last_synced_at, sync_status, account_status)"
    )
    .in("campaign_id", campaignIds);

  const unique = new Map<
    string,
    {
      id: string;
      username: string;
      lastSyncedAt: string | null;
      syncStatus: string | null;
      accountStatus: string | null;
    }
  >();

  for (const row of assignedRows ?? []) {
    const creator = firstEmbedded<{
      id: string;
      platform: string;
      username: string;
      last_synced_at: string | null;
      sync_status: string | null;
      account_status: string | null;
    }>(row.creator);
    if (
      creator &&
      creator.platform === "tiktok" &&
      !unique.has(creator.id)
    ) {
      unique.set(creator.id, {
        id: creator.id,
        username: creator.username,
        lastSyncedAt: creator.last_synced_at,
        syncStatus: creator.sync_status,
        accountStatus: creator.account_status ?? "active",
      });
    }
  }

  const creatorIds = [...unique.keys()];
  const latestSnapshotByCreatorId = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: snapshotRows } = await supabase
      .from("creator_metric_snapshots")
      .select("creator_id, captured_at")
      .in("creator_id", creatorIds)
      .order("captured_at", { ascending: false });

    for (const row of snapshotRows ?? []) {
      const id = row.creator_id as string;
      if (!latestSnapshotByCreatorId.has(id)) {
        latestSnapshotByCreatorId.set(id, row.captured_at as string);
      }
    }
  }

  const staleUsernames: string[] = [];
  for (const creator of unique.values()) {
    const decision = evaluateCreatorSyncEligibility({
      lastSyncedAt: creator.lastSyncedAt,
      syncStatus: creator.syncStatus,
      latestSuccessfulSnapshotAt:
        latestSnapshotByCreatorId.get(creator.id) ?? null,
      accountStatus: creator.accountStatus,
      force: options?.force,
      manualCooldown: false,
    });
    if (!decision.eligible) {
      continue;
    }
    try {
      staleUsernames.push(normalizeTikTokUsername(creator.username));
    } catch {
      // skip invalid
    }
  }

  // Drop usernames already present in the shared cache.
  const toFetch = staleUsernames.filter(
    (username) => !operationCache.creatorResults.has(username)
  );

  if (toFetch.length === 0) {
    return { actorRunsStarted: 0, usernamesFetched: 0 };
  }

  const orchestrated = await orchestrateCreatorBatchFetches(
    toFetch,
    (inputs) => creatorProvider.fetchCreatorProfilesBatch(inputs),
    { shouldContinue: () => hasProviderStartBudget(options?.deadlineMs) }
  );

  for (const [username, item] of orchestrated.results) {
    operationCache.creatorResults.set(username, item);
  }
  operationCache.actorRunsStarted.value += orchestrated.actorRunsStarted;
  if (operationCache.creatorActorRunsStarted) {
    operationCache.creatorActorRunsStarted.value += orchestrated.actorRunsStarted;
  }

  return {
    actorRunsStarted: orchestrated.actorRunsStarted,
    usernamesFetched: toFetch.length - orchestrated.skippedUsernames.length,
  };
}

/** One bounded manual-job chunk. Exactly one provider batch for at most 5 creators. */
export async function syncTikTokCreatorIdsBatch(
  creatorIds: string[],
  options: { client: SyncDbClient; operationCache?: TikTokSyncOperationCache }
): Promise<Array<{ id: string; outcome: "success" | "failed"; message: string }>> {
  if (creatorIds.length === 0) return [];
  if (creatorIds.length > CREATOR_BATCH_SIZE) {
    throw new Error(`Creator chunk ${CREATOR_BATCH_SIZE} kaydı aşamaz.`);
  }
  const supabase = options.client;
  const provider = resolveProvider();
  const { data } = await supabase
    .from("creators")
    .select("id, username")
    .in("id", creatorIds)
    .eq("platform", "tiktok");
  const byUsername = new Map<string, string>();
  const output: Array<{ id: string; outcome: "success" | "failed"; message: string }> = [];
  for (const row of data ?? []) {
    try {
      byUsername.set(normalizeTikTokUsername(row.username as string), row.id as string);
    } catch {
      output.push({ id: row.id as string, outcome: "failed", message: "Geçersiz TikTok kullanıcı adı." });
    }
  }
  const usernames = [...byUsername.keys()];
  if (usernames.length === 0) return output;
  const batch = await provider.fetchCreatorProfilesBatch(
    usernames.map((username) => ({ username }))
  );
  for (const username of usernames) {
    const id = byUsername.get(username)!;
    const item = batch.results.get(username);
    if (!item || item.status === "error") {
      output.push({
        id,
        outcome: "failed",
        message: item?.status === "error" ? item.error.toUserMessage() : "TikTok veri sağlayıcı sonuç döndürmedi.",
      });
      continue;
    }
    const cachedProvider: TikTokCreatorProvider = {
      fetchCreatorProfile: async () => item.profile,
      fetchCreatorProfilesBatch: async () => ({ results: new Map(), actorRunsStarted: 0 }),
    };
    const result = await syncTikTokCreator(id, cachedProvider, {
      client: supabase,
      force: true,
      manualCooldown: false,
      operationCache: options.operationCache,
    });
    output.push({ id, outcome: result.outcome === "success" ? "success" : "failed", message: result.message });
  }
  return output;
}
