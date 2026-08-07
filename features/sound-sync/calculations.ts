import type {
  SoundDailyGrowthPoint,
  SoundMetricSnapshot,
  SoundMetricSummary,
  SoundSnapshotSource,
} from "@/features/sound-sync/types";

const SNAPSHOT_STALE_MS = 24 * 60 * 60 * 1000;

export function percentageChange(
  delta: number,
  baseline: number
): number | null {
  if (baseline <= 0) {
    return null;
  }

  return (delta / baseline) * 100;
}

export function computeSoundMetricSummary(
  snapshots: Array<Pick<SoundMetricSnapshot, "usage_count" | "captured_at">>
): SoundMetricSummary {
  if (snapshots.length === 0) {
    return {
      currentUsage: null,
      initialUsage: null,
      absoluteGrowth: null,
      growthPercentage: null,
      latestDelta: null,
      latestDeltaPercentage: null,
      latestCapturedAt: null,
      snapshotCount: 0,
    };
  }

  const sorted = [...snapshots].sort(
    (left, right) =>
      new Date(left.captured_at).getTime() - new Date(right.captured_at).getTime()
  );

  const initial = sorted[0]!;
  const latest = sorted[sorted.length - 1]!;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2]! : null;

  const currentUsage = Number(latest.usage_count);
  const initialUsage = Number(initial.usage_count);
  const absoluteGrowth = currentUsage - initialUsage;
  const latestDelta =
    previous === null ? null : currentUsage - Number(previous.usage_count);

  return {
    currentUsage,
    initialUsage,
    absoluteGrowth,
    growthPercentage: percentageChange(absoluteGrowth, initialUsage),
    latestDelta,
    latestDeltaPercentage:
      latestDelta === null || previous === null
        ? null
        : percentageChange(latestDelta, Number(previous.usage_count)),
    latestCapturedAt: latest.captured_at,
    snapshotCount: sorted.length,
  };
}

export function buildSoundDailyGrowthSeries(
  snapshots: Array<
    Pick<SoundMetricSnapshot, "usage_count" | "captured_at" | "source">
  >
): SoundDailyGrowthPoint[] {
  const sorted = [...snapshots].sort((left, right) => {
    const timeDelta =
      new Date(left.captured_at).getTime() -
      new Date(right.captured_at).getTime();
    if (timeDelta !== 0) {
      return timeDelta;
    }
    // Deterministic tie-break when timestamps collide.
    return String(left.source).localeCompare(String(right.source));
  });

  return sorted.map((snapshot, index) => {
    const usageCount = Number(snapshot.usage_count);
    const previous = index > 0 ? sorted[index - 1]! : null;
    const absoluteDeltaFromPrevious =
      previous === null ? null : usageCount - Number(previous.usage_count);

    return {
      capturedAt: snapshot.captured_at,
      usageCount,
      absoluteDeltaFromPrevious,
      percentageDeltaFromPrevious:
        absoluteDeltaFromPrevious === null || previous === null
          ? null
          : percentageChange(
              absoluteDeltaFromPrevious,
              Number(previous.usage_count)
            ),
      source: (snapshot.source ?? "manual") as SoundSnapshotSource,
    };
  });
}

export function isSoundSnapshotStale(
  capturedAt: string,
  now: number = Date.now()
): boolean {
  return now - new Date(capturedAt).getTime() >= SNAPSHOT_STALE_MS;
}

export function shouldAppendSoundSnapshot(
  previous: Pick<SoundMetricSnapshot, "usage_count" | "captured_at"> | null,
  nextUsageCount: number,
  now: number = Date.now()
): boolean {
  if (!previous) {
    return true;
  }

  if (Number(previous.usage_count) !== nextUsageCount) {
    return true;
  }

  return isSoundSnapshotStale(previous.captured_at, now);
}
