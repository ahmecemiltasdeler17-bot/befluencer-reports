import type {
  CampaignAudienceSummary,
  CreatorMetricHistoryRow,
  CreatorMetricSnapshot,
  CreatorMetricSummary,
} from "@/features/creator-sync/types";

/**
 * Pure follower-growth helpers.
 *
 * Nothing here rounds or formats: callers decide presentation. Percentages
 * return null instead of Infinity when the baseline is zero, and negative growth
 * is a valid result that must survive to the UI.
 */

/** Sorts ascending by capture time without mutating the input. */
function byCapturedAtAsc(
  snapshots: CreatorMetricSnapshot[]
): CreatorMetricSnapshot[] {
  return [...snapshots].sort(
    (left, right) =>
      new Date(left.captured_at).getTime() - new Date(right.captured_at).getTime()
  );
}

export function percentageChange(
  delta: number,
  baseline: number
): number | null {
  if (baseline <= 0) {
    return null;
  }

  return (delta / baseline) * 100;
}

/**
 * Latest known follower count. Falls back to the creator row when no snapshot
 * exists, so a manually entered follower count is still reported.
 */
export function currentFollowers(
  snapshots: CreatorMetricSnapshot[],
  creatorFollowerCount: number
): number {
  const sorted = byCapturedAtAsc(snapshots);
  const latest = sorted[sorted.length - 1];

  return latest ? Number(latest.follower_count) : Number(creatorFollowerCount);
}

/** Earliest recorded follower count — the growth baseline. */
export function initialFollowers(
  snapshots: CreatorMetricSnapshot[]
): number | null {
  const sorted = byCapturedAtAsc(snapshots);
  const first = sorted[0];

  return first ? Number(first.follower_count) : null;
}

export function buildCreatorMetricSummary(
  snapshots: CreatorMetricSnapshot[],
  creatorFollowerCount: number
): CreatorMetricSummary {
  const sorted = byCapturedAtAsc(snapshots);
  const latest = sorted[sorted.length - 1] ?? null;
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const first = sorted[0] ?? null;

  const current = currentFollowers(sorted, creatorFollowerCount);
  const initial = first ? Number(first.follower_count) : null;

  const absoluteGrowth = initial === null ? null : current - initial;
  const growth =
    absoluteGrowth === null || initial === null
      ? null
      : percentageChange(absoluteGrowth, initial);

  const latestDelta =
    latest && previous
      ? Number(latest.follower_count) - Number(previous.follower_count)
      : null;
  const latestDeltaPercentage =
    latestDelta === null || !previous
      ? null
      : percentageChange(latestDelta, Number(previous.follower_count));

  return {
    snapshotCount: sorted.length,
    currentFollowers: current,
    initialFollowers: initial,
    absoluteGrowth,
    growthPercentage: growth,
    latestDelta,
    latestDeltaPercentage,
    followingCount:
      latest?.following_count === null || latest?.following_count === undefined
        ? null
        : Number(latest.following_count),
    totalLikes:
      latest?.total_likes === null || latest?.total_likes === undefined
        ? null
        : Number(latest.total_likes),
    videoCount:
      latest?.video_count === null || latest?.video_count === undefined
        ? null
        : Number(latest.video_count),
    firstCapturedAt: first?.captured_at ?? null,
    latestCapturedAt: latest?.captured_at ?? null,
  };
}

/**
 * Builds the newest-first history rows shown on the creator detail page, with
 * each row's delta measured against the chronologically previous snapshot.
 */
export function buildCreatorMetricHistory(
  snapshots: CreatorMetricSnapshot[]
): CreatorMetricHistoryRow[] {
  const ascending = byCapturedAtAsc(snapshots);

  const rows = ascending.map((snapshot, index) => {
    const previous = index > 0 ? ascending[index - 1] : null;
    const followerDelta = previous
      ? Number(snapshot.follower_count) - Number(previous.follower_count)
      : null;

    return {
      ...snapshot,
      follower_count: Number(snapshot.follower_count),
      followerDelta,
      followerDeltaPercentage:
        followerDelta === null || !previous
          ? null
          : percentageChange(followerDelta, Number(previous.follower_count)),
    };
  });

  return rows.reverse();
}

/**
 * Aggregate follower reach across a campaign's creators.
 *
 * Creators are deduplicated by id: an assignment appearing twice must not double
 * the audience. A creator with no snapshot contributes its current follower
 * count to both sides, so it adds zero growth rather than a false gain.
 */
export function buildCampaignAudienceSummary(
  creators: Array<{
    creatorId: string;
    currentFollowers: number;
    initialFollowers: number | null;
  }>
): CampaignAudienceSummary {
  const unique = new Map<string, (typeof creators)[number]>();

  for (const creator of creators) {
    if (!unique.has(creator.creatorId)) {
      unique.set(creator.creatorId, creator);
    }
  }

  let currentAudience = 0;
  let initialAudience = 0;

  for (const creator of unique.values()) {
    currentAudience += creator.currentFollowers;
    initialAudience += creator.initialFollowers ?? creator.currentFollowers;
  }

  const audienceGrowth = currentAudience - initialAudience;

  return {
    creatorCount: unique.size,
    currentAudience,
    initialAudience,
    audienceGrowth,
    growthPercentage: percentageChange(audienceGrowth, initialAudience),
  };
}

const SNAPSHOT_STALE_MS = 24 * 60 * 60 * 1000;

export function isCreatorSnapshotStale(
  capturedAt: string,
  now: number = Date.now()
): boolean {
  return now - new Date(capturedAt).getTime() >= SNAPSHOT_STALE_MS;
}

export type CreatorSnapshotCandidate = {
  followerCount: number;
  followingCount: number | null;
  totalLikes: number | null;
  videoCount: number | null;
};

function optionalChanged(
  previous: number | null | undefined,
  next: number | null
): boolean {
  const normalizedPrevious =
    previous === null || previous === undefined ? null : Number(previous);

  // A provider that stopped reporting an optional field is not a change: it
  // would otherwise append a snapshot on every sync.
  if (next === null) {
    return false;
  }

  return normalizedPrevious !== next;
}

/**
 * Decides whether a sync should append a new snapshot.
 *
 * Appending on every sync would bloat the series with identical rows, so a
 * snapshot is written only when something changed or the last one is a day old —
 * the latter keeps a visible heartbeat for a creator whose count is flat.
 */
export function shouldAppendCreatorSnapshot(
  previous: CreatorMetricSnapshot | null,
  next: CreatorSnapshotCandidate,
  now: number = Date.now()
): boolean {
  if (!previous) {
    return true;
  }

  if (Number(previous.follower_count) !== next.followerCount) {
    return true;
  }

  if (
    optionalChanged(previous.following_count, next.followingCount) ||
    optionalChanged(previous.total_likes, next.totalLikes) ||
    optionalChanged(previous.video_count, next.videoCount)
  ) {
    return true;
  }

  return isCreatorSnapshotStale(previous.captured_at, now);
}

/** Splits assignments into syncable TikTok creators and skipped others. */
export function partitionSyncableCreators<
  T extends { creatorId: string; platform: string },
>(creators: T[]): { syncable: T[]; skipped: T[] } {
  const seen = new Set<string>();
  const syncable: T[] = [];
  const skipped: T[] = [];

  for (const creator of creators) {
    if (seen.has(creator.creatorId)) {
      continue;
    }

    seen.add(creator.creatorId);

    if (creator.platform === "tiktok") {
      syncable.push(creator);
    } else {
      skipped.push(creator);
    }
  }

  return { syncable, skipped };
}
