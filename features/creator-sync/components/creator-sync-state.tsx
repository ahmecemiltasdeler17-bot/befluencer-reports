import type { CreatorSyncStatus } from "@/features/creator-sync/types";
import { MetricDelta } from "@/features/metrics/components/metric-delta";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<CreatorSyncStatus, string> = {
  pending: "Beklemede",
  success: "Başarılı",
  failed: "Başarısız",
};

const STATUS_TONES: Record<CreatorSyncStatus, string> = {
  pending: "text-zinc-500",
  success: "text-emerald-400",
  failed: "text-red-400",
};

function formatRelativeDate(value: string | null): string {
  if (!value) {
    return "Hiç";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** Compact sync state for table rows: status badge over last sync time. */
export function CreatorSyncStateCell({
  status,
  lastSyncedAt,
}: {
  status: CreatorSyncStatus;
  lastSyncedAt: string | null;
}) {
  return (
    <div className="space-y-0.5">
      <p className={cn("text-xs font-medium", STATUS_TONES[status])}>
        {STATUS_LABELS[status]}
      </p>
      <p className="text-xs whitespace-nowrap text-zinc-500">
        {formatRelativeDate(lastSyncedAt)}
      </p>
    </div>
  );
}

/**
 * Growth since the first recorded snapshot. Renders an em dash when a creator has
 * fewer than one snapshot, so an absent baseline is never shown as zero growth.
 */
export function CreatorGrowthCell({
  absoluteGrowth,
  growthPercentage,
}: {
  absoluteGrowth: number | null;
  growthPercentage: number | null;
}) {
  if (absoluteGrowth === null) {
    return <span className="text-xs text-zinc-500">—</span>;
  }

  return (
    <MetricDelta value={absoluteGrowth} percentage={growthPercentage} />
  );
}
