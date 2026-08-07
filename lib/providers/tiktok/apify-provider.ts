import "server-only";

import { getServerEnv } from "@/lib/env.server";
import {
  mapHttpStatusToProviderError,
  TikTokProviderError,
} from "@/lib/providers/tiktok/errors";
import { parseApifyTikTokCreatorDataset } from "@/lib/providers/tiktok/parse-apify-creator";
import { parseApifyTikTokDataset } from "@/lib/providers/tiktok/parse-apify-item";
import { parseApifyTikTokSoundDataset } from "@/lib/providers/tiktok/parse-apify-sound";
import { assertApprovedTikTokProfile } from "@/lib/providers/tiktok/profile-url";
import type { TikTokProvider } from "@/lib/providers/tiktok/provider";
import { assertApprovedTikTokSoundUrl } from "@/lib/providers/tiktok/sound-url";
import type {
  FetchCreatorProfileInput,
  FetchSoundProfileInput,
  TikTokCreatorProfile,
  TikTokSoundProfile,
  TikTokVideoMetrics,
} from "@/lib/providers/tiktok/types";
import {
  itemsFromApifyAuthorCache,
  logApifyCreatorRunDiagnostics,
  readApifyRunDatasetRef,
  unwrapApifyCreatorItems,
} from "@/lib/providers/tiktok/unwrap-apify-creator-items";
import { assertApprovedTikTokUrl } from "@/lib/providers/tiktok/url";

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
  private readonly actorId: string;
  private readonly creatorActorId: string;
  private readonly soundActorId: string;

  constructor(
    token: string,
    actorId: string,
    creatorActorId?: string,
    soundActorId?: string
  ) {
    this.token = token;
    this.actorId = actorId;
    // Falls back to the video actor: most TikTok actors accept profile input and
    // return author statistics, so a second actor is opt-in rather than required.
    this.creatorActorId = creatorActorId?.trim() || actorId;
    // Prefer a dedicated sound actor when configured; otherwise reuse the main
    // actor with a `musics` input (clockworks scrapers accept both shapes).
    this.soundActorId = soundActorId?.trim() || actorId;
  }

  /**
   * Runs an actor and returns its dataset. Bounded by an abort timeout, and it
   * never surfaces the upstream body — only a typed provider error.
   */
  private async runActor(
    actorId: string,
    input: Record<string, unknown>
  ): Promise<unknown[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(buildActorRunSyncUrl(actorId, this.token), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        throw mapHttpStatusToProviderError(response.status);
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
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw mapHttpStatusToProviderError(response.status);
    }

    return response.json();
  }

  /** Returns null when the KV record is absent (404). */
  private async fetchOptionalJson(url: string): Promise<unknown | null> {
    const response = await fetch(url, {
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

    throw new TikTokProviderError("upstream_failure");
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
    input: Record<string, unknown>
  ): Promise<unknown[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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

      if (ref.status !== "SUCCEEDED") {
        throw new TikTokProviderError("upstream_failure");
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

      return unwrapped;
    } catch (error) {
      if (error instanceof TikTokProviderError) {
        throw error;
      }

      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        throw new TikTokProviderError("upstream_failure");
      }

      throw new TikTokProviderError("upstream_failure");
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchVideoMetrics(videoUrl: string): Promise<TikTokVideoMetrics> {
    const normalized = assertApprovedTikTokUrl(videoUrl);

    const dataset = await this.runActor(this.actorId, {
      postURLs: [normalized.normalizedUrl],
      resultsPerPage: 1,
    });

    return parseApifyTikTokDataset(dataset, normalized.normalizedUrl);
  }

  async fetchCreatorProfile(
    input: FetchCreatorProfileInput
  ): Promise<TikTokCreatorProfile> {
    // Only a normalized handle reaches the provider, so an arbitrary
    // user-supplied URL can never be fetched.
    const { username, profileUrl } = assertApprovedTikTokProfile(input);

    // Profile scrape via the profiles[] field — never send a profile URL through
    // postURLs (video-only). resultsPerPage: 1 keeps authorMeta on a single row
    // when the actor emits videos; media/comment downloads stay off.
    const dataset = await this.runCreatorActor(this.creatorActorId, {
      profiles: [username],
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
      // Some actor versions accept a profile start URL; never a post URL.
      startUrls: [{ url: profileUrl }],
    });

    return parseApifyTikTokCreatorDataset(dataset, username);
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

export function createApifyTikTokProvider(): TikTokProvider {
  const env = getServerEnv();

  return new ApifyTikTokProvider(
    env.APIFY_API_TOKEN,
    env.APIFY_TIKTOK_ACTOR_ID,
    process.env.APIFY_TIKTOK_CREATOR_ACTOR_ID,
    process.env.APIFY_TIKTOK_SOUND_ACTOR_ID
  );
}
