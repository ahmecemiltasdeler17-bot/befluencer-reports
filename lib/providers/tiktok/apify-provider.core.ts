import {
  assertCreatorBatchInputIntact,
  buildCreatorBatchInput,
} from "@/lib/providers/tiktok/build-creator-batch-input";
import { classifyEmptySucceededVideoRun } from "@/lib/providers/tiktok/detect-login-required";
import {
  mapActorTerminalStatus,
  mapHttpStatusToProviderError,
  readApifyErrorType,
  TikTokProviderError,
} from "@/lib/providers/tiktok/errors";
import { parseApifyTikTokCreatorDataset } from "@/lib/providers/tiktok/parse-apify-creator";
import { parseApifyTikTokDatasetBatch } from "@/lib/providers/tiktok/parse-apify-item";
import { parseApifyTikTokSoundDataset } from "@/lib/providers/tiktok/parse-apify-sound";
import {
  assertApprovedTikTokProfile,
  normalizeTikTokUsername,
} from "@/lib/providers/tiktok/profile-url";
import type { TikTokProvider } from "@/lib/providers/tiktok/provider";
import { assertApprovedTikTokSoundUrl } from "@/lib/providers/tiktok/sound-url";
import {
  ApifyRunTracker,
  getDefaultApifyRunTracker,
} from "@/lib/providers/tiktok/apify-run-tracker";
import type {
  FetchCreatorProfileInput,
  FetchSoundProfileInput,
  TikTokCreatorBatchFetchResult,
  TikTokCreatorBatchItemResult,
  TikTokCreatorProfile,
  TikTokSoundProfile,
  TikTokVideoBatchFetchResult,
  TikTokVideoBatchItemResult,
  TikTokVideoBatchRequest,
  TikTokVideoMetrics,
} from "@/lib/providers/tiktok/types";
import {
  itemsFromApifyAuthorCache,
  logApifyCreatorRunDiagnostics,
  logApifyCreatorSyncStage,
  readApifyRunDatasetRef,
  unwrapApifyCreatorItems,
} from "@/lib/providers/tiktok/unwrap-apify-creator-items";
import { assertApprovedTikTokUrl } from "@/lib/providers/tiktok/url";

export type ApifyFetchImpl = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

const REQUEST_TIMEOUT_MS = 120_000;
const RUN_WAIT_FOR_FINISH_SECONDS = 120;
const RUN_POLL_ATTEMPTS = 60;
const RUN_POLL_INTERVAL_MS = 2_000;
const DATASET_SETTLE_ATTEMPTS = 5;
const DATASET_SETTLE_INTERVAL_MS = 1_000;

const TERMINAL_RUN_STATUSES = new Set([
  "SUCCEEDED",
  "FAILED",
  "ABORTED",
  "TIMED-OUT",
]);

function buildActorRunSyncUrl(actorId: string, token: string): string {
  const encodedActorId = encodeURIComponent(actorId);
  const params = new URLSearchParams({
    token,
    timeout: "120",
    memory: "1024",
  });

  return `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?${params.toString()}`;
}

function buildActorStartRunUrl(actorId: string, token: string): string {
  const encodedActorId = encodeURIComponent(actorId);
  const params = new URLSearchParams({
    token,
    waitForFinish: String(RUN_WAIT_FOR_FINISH_SECONDS),
    memory: "1024",
  });

  return `https://api.apify.com/v2/acts/${encodedActorId}/runs?${params.toString()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class ApifyTikTokProvider implements TikTokProvider {
  private readonly token: string;
  /** Actor used for video URL metric fetches (`APIFY_TIKTOK_VIDEO_ACTOR_ID` or fallback). */
  private readonly videoActorId: string;
  /** Shared fallback actor id (`APIFY_TIKTOK_ACTOR_ID`). */
  private readonly defaultActorId: string;
  private readonly creatorActorId: string;
  private readonly soundActorId: string;
  private readonly fetchImpl: ApifyFetchImpl;
  private readonly runTracker: ApifyRunTracker;

  constructor(
    token: string,
    defaultActorId: string,
    options?: {
      videoActorId?: string | null;
      creatorActorId?: string | null;
      soundActorId?: string | null;
      /** Injectable fetch for regression tests — production uses global fetch. */
      fetchImpl?: ApifyFetchImpl;
      runTracker?: ApifyRunTracker;
    }
  ) {
    this.token = token;
    this.defaultActorId = defaultActorId;
    this.videoActorId = options?.videoActorId?.trim() || defaultActorId;
    // Falls back to the default actor: most TikTok actors accept profile input
    // and return author statistics, so a second actor is opt-in.
    this.creatorActorId =
      options?.creatorActorId?.trim() || defaultActorId;
    // Prefer a dedicated sound actor when configured; otherwise reuse default.
    this.soundActorId = options?.soundActorId?.trim() || defaultActorId;
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.runTracker = options?.runTracker ?? getDefaultApifyRunTracker();
  }

  getActorRunsStarted(): number {
    return this.runTracker.actorRunsStarted;
  }

  getVideoActorId(): string {
    return this.videoActorId;
  }

  getCreatorActorId(): string {
    return this.creatorActorId;
  }

  /**
   * Runs an actor and returns its dataset. Bounded by an abort timeout, and it
   * never surfaces the upstream body — only a typed provider error.
   */
  private async runActor(
    actorId: string,
    input: Record<string, unknown>,
    kind: "sound" = "sound"
  ): Promise<unknown[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const batchSize = Array.isArray(input.musics)
      ? input.musics.length
      : Array.isArray(input.postURLs)
        ? input.postURLs.length
        : Array.isArray(input.profiles)
          ? input.profiles.length
          : 1;

    // Count ONLY at the real actor-start HTTP POST.
    this.runTracker.record({ kind, batchSize, actorId });

    try {
      const response = await this.fetchImpl(
        buildActorRunSyncUrl(actorId, this.token),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: controller.signal,
          cache: "no-store",
        }
      );

      if (!response.ok) {
        let errorType: string | null = null;
        try {
          const body: unknown = await response.json();
          errorType = readApifyErrorType(body);
        } catch {
          // status mapping is enough when the body is not JSON
        }
        throw mapHttpStatusToProviderError(response.status, errorType);
      }

      const payload: unknown = await response.json();

      if (!Array.isArray(payload)) {
        throw new TikTokProviderError("malformed_result");
      }

      return payload;
    } catch (error) {
      if (error instanceof TikTokProviderError) {
        throw error;
      }

      throw new TikTokProviderError("upstream_failure");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchJson(
    url: string,
    init?: RequestInit
  ): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      let errorType: string | null = null;
      try {
        const body: unknown = await response.json();
        errorType = readApifyErrorType(body);
      } catch {
        // Ignore non-JSON error bodies — status mapping is enough.
      }
      throw mapHttpStatusToProviderError(response.status, errorType);
    }

    return response.json();
  }

  /** Returns null when the KV record is absent (404). */
  private async fetchOptionalJson(url: string): Promise<unknown | null> {
    const response = await this.fetchImpl(url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw mapHttpStatusToProviderError(response.status);
    }

    return response.json();
  }

  private async pollRunUntilTerminal(runId: string): Promise<{
    status: string | null;
    datasetId: string | null;
    keyValueStoreId: string | null;
  }> {
    let status: string | null = null;
    let datasetId: string | null = null;
    let keyValueStoreId: string | null = null;

    for (let attempt = 0; attempt < RUN_POLL_ATTEMPTS; attempt += 1) {
      const payload = await this.fetchJson(
        `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`
      );
      const ref = readApifyRunDatasetRef(payload);
      status = ref.status;
      datasetId = ref.datasetId ?? datasetId;
      keyValueStoreId = ref.keyValueStoreId ?? keyValueStoreId;

      if (status && TERMINAL_RUN_STATUSES.has(status)) {
        return { status, datasetId, keyValueStoreId };
      }

      await sleep(RUN_POLL_INTERVAL_MS);
    }

    throw new TikTokProviderError("provider_timeout");
  }

  private async fetchDatasetItems(datasetId: string): Promise<unknown[]> {
    // Bound a short settle loop: Apify can report SUCCEEDED before the first
    // dataset read sees rows. Never treat that first empty response as final.
    let items: unknown[] = [];

    for (let attempt = 0; attempt < DATASET_SETTLE_ATTEMPTS; attempt += 1) {
      const payload = await this.fetchJson(
        `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=1&format=json`
      );

      if (!Array.isArray(payload)) {
        throw new TikTokProviderError("malformed_result");
      }

      items = payload;

      if (items.length > 0) {
        return items;
      }

      if (attempt < DATASET_SETTLE_ATTEMPTS - 1) {
        await sleep(DATASET_SETTLE_INTERVAL_MS);
      }
    }

    return items;
  }

  private async fetchAuthorCacheItems(
    keyValueStoreId: string
  ): Promise<unknown[]> {
    const payload = await this.fetchOptionalJson(
      `https://api.apify.com/v2/key-value-stores/${encodeURIComponent(keyValueStoreId)}/records/AUTHOR_CACHE`
    );

    if (payload === null) {
      return [];
    }

    return itemsFromApifyAuthorCache(payload);
  }

  /**
   * Creator sync must use the current run's `defaultDatasetId` after SUCCEEDED.
   * Clockworks often loads profile info into KV `AUTHOR_CACHE` while pushing
   * zero video rows when the profile has no parseable posts.
   */
  private async runCreatorActor(
    actorId: string,
    input: Record<string, unknown>,
    expectedBatchSize: number
  ): Promise<unknown[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startedAt = Date.now();
    const profilesCount = Array.isArray(input.profiles)
      ? input.profiles.length
      : 0;
    const startUrlsCount = Array.isArray(input.startUrls)
      ? input.startUrls.length
      : 0;

    // Hard fail if a multi-creator batch collapsed before the HTTP POST.
    assertCreatorBatchInputIntact(input, expectedBatchSize);

    // Count ONLY at the real actor-start HTTP POST.
    this.runTracker.record({
      kind: "creator",
      batchSize: profilesCount,
      expectedBatchSize,
      profilesCount,
      startUrlsCount,
      actorId,
    });

    logApifyCreatorSyncStage({
      operation: "creator_profile_sync",
      stage: "actor_start",
      actorIdPresent: Boolean(actorId),
      tokenPresent: Boolean(this.token),
    });

    try {
      const startPayload = await this.fetchJson(
        buildActorStartRunUrl(actorId, this.token),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: controller.signal,
        }
      );

      let ref = readApifyRunDatasetRef(startPayload);

      logApifyCreatorSyncStage({
        operation: "creator_profile_sync",
        stage: "run_started",
        actorIdPresent: true,
        tokenPresent: true,
        runId: ref.runId,
        runStatus: ref.status,
        defaultDatasetIdPresent: Boolean(ref.datasetId),
      });

      if (!ref.runId) {
        throw new TikTokProviderError("malformed_result");
      }

      if (!ref.status || !TERMINAL_RUN_STATUSES.has(ref.status)) {
        const polled = await this.pollRunUntilTerminal(ref.runId);
        ref = {
          ...ref,
          status: polled.status,
          datasetId: polled.datasetId ?? ref.datasetId,
          keyValueStoreId: polled.keyValueStoreId ?? ref.keyValueStoreId,
        };
      }

      logApifyCreatorSyncStage({
        operation: "creator_profile_sync",
        stage: "run_terminal",
        runId: ref.runId,
        runStatus: ref.status,
        defaultDatasetIdPresent: Boolean(ref.datasetId),
        durationMs: Date.now() - startedAt,
      });

      const terminalError = mapActorTerminalStatus(ref.status);
      if (terminalError) {
        throw terminalError;
      }

      if (!ref.datasetId) {
        throw new TikTokProviderError(
          "empty_result",
          "TikTok sağlayıcısı bu profil için boş sonuç döndürdü."
        );
      }

      // Always the current run's dataset — never a reused ID or the start body.
      const datasetItems = await this.fetchDatasetItems(ref.datasetId);
      const authorCacheItems = ref.keyValueStoreId
        ? await this.fetchAuthorCacheItems(ref.keyValueStoreId)
        : [];

      const sourceItems =
        datasetItems.length > 0 ? datasetItems : authorCacheItems;
      const unwrapped = unwrapApifyCreatorItems(sourceItems);

      logApifyCreatorRunDiagnostics({
        status: ref.status,
        datasetIdPresent: true,
        datasetItemCount: datasetItems.length,
        authorCacheItemCount: authorCacheItems.length,
        items: sourceItems,
        source:
          datasetItems.length > 0
            ? "dataset"
            : authorCacheItems.length > 0
              ? "author_cache"
              : "empty",
      });

      logApifyCreatorSyncStage({
        operation: "creator_profile_sync",
        stage: "dataset_ready",
        runId: ref.runId,
        runStatus: ref.status,
        defaultDatasetIdPresent: true,
        datasetItemCount: datasetItems.length,
        authorCacheFound: authorCacheItems.length > 0,
        durationMs: Date.now() - startedAt,
      });

      return unwrapped;
    } catch (error) {
      if (error instanceof TikTokProviderError) {
        logApifyCreatorSyncStage({
          operation: "creator_profile_sync",
          stage: "failed",
          errorCode: error.code,
          durationMs: Date.now() - startedAt,
        });
        throw error;
      }

      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        logApifyCreatorSyncStage({
          operation: "creator_profile_sync",
          stage: "failed",
          errorCode: "provider_timeout",
          durationMs: Date.now() - startedAt,
        });
        throw new TikTokProviderError("provider_timeout");
      }

      logApifyCreatorSyncStage({
        operation: "creator_profile_sync",
        stage: "failed",
        errorCode: "upstream_failure",
        durationMs: Date.now() - startedAt,
      });
      throw new TikTokProviderError("upstream_failure");
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Video metrics via start/poll so empty SUCCEEDED runs can inspect Apify logs
   * for login/sensitive skips. Does not auto-retry the same anonymous actor when
   * `login_required_content` is classified.
   */
  async fetchVideoMetrics(videoUrl: string): Promise<TikTokVideoMetrics> {
    const normalized = assertApprovedTikTokUrl(videoUrl);
    const batch = await this.fetchVideoMetricsBatch([
      {
        videoUrl: normalized.normalizedUrl,
        platformVideoId: normalized.platformVideoId,
      },
    ]);
    const result = batch.results.get(normalized.normalizedUrl);
    if (!result) {
      throw new TikTokProviderError("empty_result");
    }
    if (result.status === "error") {
      throw result.error;
    }
    return result.metrics;
  }

  /**
   * Batched video fetch: N postURLs → exactly 1 actor start for this call.
   * Matching is by platform_video_id / normalized URL — never by result order.
   * Does NOT loop single-item fetches.
   */
  async fetchVideoMetricsBatch(
    requests: TikTokVideoBatchRequest[]
  ): Promise<TikTokVideoBatchFetchResult> {
    const startsBefore = this.runTracker.actorRunsStarted;
    const prepared: Array<{
      normalizedUrl: string;
      platformVideoId: string | null;
    }> = [];
    const seen = new Set<string>();

    for (const request of requests) {
      let normalized;
      try {
        normalized = assertApprovedTikTokUrl(request.videoUrl);
      } catch {
        const key = request.videoUrl.trim();
        if (key) {
          prepared.push({
            normalizedUrl: key,
            platformVideoId: request.platformVideoId ?? null,
          });
        }
        continue;
      }

      if (seen.has(normalized.normalizedUrl)) {
        continue;
      }
      seen.add(normalized.normalizedUrl);
      prepared.push({
        normalizedUrl: normalized.normalizedUrl,
        platformVideoId:
          request.platformVideoId ?? normalized.platformVideoId,
      });
    }

    const out = new Map<string, TikTokVideoBatchItemResult>();
    if (prepared.length === 0) {
      return { results: out, actorRunsStarted: 0 };
    }

    const validPrepared = prepared.filter((item) => {
      try {
        assertApprovedTikTokUrl(item.normalizedUrl);
        return true;
      } catch {
        out.set(item.normalizedUrl, {
          status: "error",
          error: new TikTokProviderError("invalid_url"),
        });
        return false;
      }
    });

    if (validPrepared.length === 0) {
      return { results: out, actorRunsStarted: 0 };
    }

    const postURLs = validPrepared.map((item) => item.normalizedUrl);

    // Single actor start for the entire batch.
    const run = await this.runVideoActor(this.videoActorId, {
      postURLs,
      resultsPerPage: Math.max(postURLs.length, 1),
    });

    const parsed = parseApifyTikTokDatasetBatch(run.items, validPrepared);

    let loginRequiredForMissing = false;
    const hasMissing = [...parsed.values()].some(
      (item) =>
        item.status === "error" && item.error.code === "empty_result"
    );

    if (hasMissing || run.items.length === 0) {
      const logText = run.runId
        ? await this.fetchRunLogText(run.runId)
        : null;
      const classified = classifyEmptySucceededVideoRun({
        logText,
        datasetItems: run.items,
      });
      loginRequiredForMissing = classified === "login_required_content";
    }

    for (const [url, item] of parsed) {
      if (
        item.status === "error" &&
        item.error.code === "empty_result" &&
        loginRequiredForMissing
      ) {
        out.set(url, {
          status: "error",
          error: new TikTokProviderError("login_required_content"),
        });
        continue;
      }
      out.set(url, item);
    }

    return {
      results: out,
      actorRunsStarted: this.runTracker.actorRunsStarted - startsBefore,
    };
  }

  /**
   * Async actor run for video posts — exposes runId for optional log inspection.
   * Sound sync continues to use `runActor` (sync dataset path).
   */
  private async runVideoActor(
    actorId: string,
    input: Record<string, unknown>
  ): Promise<{
    items: unknown[];
    runId: string | null;
    status: string | null;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const batchSize = Array.isArray(input.postURLs)
      ? input.postURLs.length
      : 1;

    // Count ONLY at the real actor-start HTTP POST.
    this.runTracker.record({
      kind: "video",
      batchSize,
      actorId,
    });

    try {
      const startPayload = await this.fetchJson(
        buildActorStartRunUrl(actorId, this.token),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: controller.signal,
        }
      );

      let ref = readApifyRunDatasetRef(startPayload);

      if (!ref.runId) {
        throw new TikTokProviderError("malformed_result");
      }

      if (!ref.status || !TERMINAL_RUN_STATUSES.has(ref.status)) {
        const polled = await this.pollRunUntilTerminal(ref.runId);
        ref = {
          ...ref,
          status: polled.status,
          datasetId: polled.datasetId ?? ref.datasetId,
          keyValueStoreId: polled.keyValueStoreId ?? ref.keyValueStoreId,
        };
      }

      const terminalError = mapActorTerminalStatus(ref.status);
      if (terminalError) {
        throw terminalError;
      }

      if (!ref.datasetId) {
        return { items: [], runId: ref.runId, status: ref.status };
      }

      const items = await this.fetchDatasetItems(ref.datasetId);
      return { items, runId: ref.runId, status: ref.status };
    } catch (error) {
      if (error instanceof TikTokProviderError) {
        throw error;
      }

      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        throw new TikTokProviderError("provider_timeout");
      }

      throw new TikTokProviderError("upstream_failure");
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Best-effort log fetch — never throws; missing logs → null. */
  private async fetchRunLogText(runId: string): Promise<string | null> {
    try {
      const response = await this.fetchImpl(
        `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}/log`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      return typeof text === "string" ? text : null;
    } catch {
      return null;
    }
  }

  /**
   * Single classification attempt after a finished run — no second actor start.
   */
  private async throwIfLoginRequiredVideoRun(run: {
    items: unknown[];
    runId: string | null;
  }): Promise<void> {
    const logText = run.runId ? await this.fetchRunLogText(run.runId) : null;
    const classified = classifyEmptySucceededVideoRun({
      logText,
      datasetItems: run.items,
    });

    if (classified === "login_required_content") {
      throw new TikTokProviderError("login_required_content");
    }
  }

  async fetchCreatorProfile(
    input: FetchCreatorProfileInput
  ): Promise<TikTokCreatorProfile> {
    const { username } = assertApprovedTikTokProfile(input);
    const batch = await this.fetchCreatorProfilesBatch([input]);
    const key = normalizeTikTokUsername(username);
    const result = batch.results.get(key);
    if (!result) {
      throw new TikTokProviderError("empty_result");
    }
    if (result.status === "error") {
      throw result.error;
    }
    return result.profile;
  }

  /**
   * Batched creator fetch: N profiles → exactly 1 actor start for this call.
   * Builds ONE input via buildCreatorBatchInput — never loops single-creator input.
   * Each username is rematched via strict identity (never display name / order).
   */
  async fetchCreatorProfilesBatch(
    inputs: FetchCreatorProfileInput[]
  ): Promise<TikTokCreatorBatchFetchResult> {
    const startsBefore = this.runTracker.actorRunsStarted;
    const out = new Map<string, TikTokCreatorBatchItemResult>();
    const validUsernames: string[] = [];

    for (const input of inputs) {
      try {
        const { username } = assertApprovedTikTokProfile(input);
        validUsernames.push(normalizeTikTokUsername(username));
      } catch (error) {
        const fallbackKey = (input.username ?? "")
          .trim()
          .replace(/^@+/, "")
          .toLowerCase();
        if (fallbackKey) {
          out.set(fallbackKey, {
            status: "error",
            error:
              error instanceof TikTokProviderError
                ? error
                : new TikTokProviderError("invalid_username"),
          });
        }
      }
    }

    if (validUsernames.length === 0) {
      return { results: out, actorRunsStarted: 0 };
    }

    // ONE batch-native input object — not N single-creator builders.
    const { prepared, input } = buildCreatorBatchInput(validUsernames);
    const expectedBatchSize = prepared.length;

    // Single actor start for the entire batch.
    const dataset = await this.runCreatorActor(
      this.creatorActorId,
      input as unknown as Record<string, unknown>,
      expectedBatchSize
    );

    for (const item of prepared) {
      try {
        const profile = parseApifyTikTokCreatorDataset(
          dataset,
          item.username
        );
        out.set(item.username, { status: "ok", profile });
      } catch (error) {
        out.set(item.username, {
          status: "error",
          error:
            error instanceof TikTokProviderError
              ? error
              : new TikTokProviderError("malformed_result"),
        });
      }
    }

    return {
      results: out,
      actorRunsStarted: this.runTracker.actorRunsStarted - startsBefore,
    };
  }

  async fetchSoundProfile(
    input: FetchSoundProfileInput
  ): Promise<TikTokSoundProfile> {
    const normalized = assertApprovedTikTokSoundUrl(input.soundUrl);
    const soundId = input.soundId ?? normalized.soundId ?? undefined;

    // Smallest useful request: one music URL, one page of results, no media.
    // Total usage must come from an explicit field on the result (e.g.
    // searchMusic.videos / musicMeta.videoCount) — never from item count.
    const dataset = await this.runActor(this.soundActorId, {
      musics: [normalized.normalizedUrl],
      resultsPerPage: 1,
      shouldDownloadCovers: false,
      shouldDownloadVideos: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadAvatars: false,
      shouldDownloadMusicCovers: false,
      searchQueries: [],
    });

    try {
      return parseApifyTikTokSoundDataset(dataset, {
        soundUrl: normalized.normalizedUrl,
        soundId: soundId ?? null,
        canonicalPath: normalized.canonicalPath,
      });
    } catch (error) {
      if (
        error instanceof TikTokProviderError &&
        error.code === "empty_result"
      ) {
        throw new TikTokProviderError("sound_not_found");
      }
      throw error;
    }
  }
}

