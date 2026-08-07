import { MetricDelta } from "@/features/metrics/components/metric-delta";
import type {
  CreatorMetricSummary,
  CreatorSyncStatus,
} from "@/features/creator-sync/types";
import { CompactCountText } from "@/components/format/compact-count-text";
import { formatReportCompactCount } from "@/lib/format";
import { cn } from "@/lib/utils";

const SYNC_STATUS_LABELS: Record<CreatorSyncStatus, string> = {
  pending: "Beklemede",
  success: "Başarılı",
  failed: "Başarısız",
};

const SYNC_STATUS_TONES: Record<CreatorSyncStatus, string> = {
  pending: "text-zinc-400",
  success: "text-emerald-400",
  failed: "text-red-400",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Henüz güncellenmedi";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CreatorSyncStatusLabel({
  status,
}: {
  status: CreatorSyncStatus;
}) {
  return (
    <span className={cn("text-sm", SYNC_STATUS_TONES[status])}>
      {SYNC_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Follower growth overview for the creator detail page.
 *
 * "Takipçi" is deliberately never called reach: a follower count is an audience
 * size, not an impression count.
 */
export function CreatorFollowerSummary({
  summary,
  syncStatus,
  lastSyncedAt,
  syncAction,
}: {
  summary: CreatorMetricSummary;
  syncStatus: CreatorSyncStatus;
  lastSyncedAt: string | null;
  syncAction?: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-white">Takipçi Verisi</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Son güncelleme: {formatDateTime(lastSyncedAt)} ·{" "}
            <CreatorSyncStatusLabel status={syncStatus} />
          </p>
        </div>
        {syncAction}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat
          label="Güncel takipçi"
          value={
            <CompactCountText value={summary.currentFollowers} />
          }
        />
        <SummaryStat
          label="İlk kayıt"
          value={
            summary.initialFollowers === null ? (
              "—"
            ) : (
              <CompactCountText value={summary.initialFollowers} />
            )
          }
          hint={
            summary.firstCapturedAt
              ? formatDateTime(summary.firstCapturedAt)
              : "Henüz kayıt yok"
          }
        />
        <SummaryStat
          label="Toplam büyüme"
          value={
            summary.absoluteGrowth === null ? (
              "—"
            ) : (
              <CompactCountText value={summary.absoluteGrowth} />
            )
          }
          delta={
            summary.absoluteGrowth === null ? null : (
              <MetricDelta
                value={summary.absoluteGrowth}
                percentage={summary.growthPercentage}
              />
            )
          }
        />
        <SummaryStat
          label="Son değişim"
          value={
            summary.latestDelta === null ? (
              "—"
            ) : (
              <CompactCountText value={summary.latestDelta} />
            )
          }
          delta={
            summary.latestDelta === null ? null : (
              <MetricDelta
                value={summary.latestDelta}
                percentage={summary.latestDeltaPercentage}
              />
            )
          }
        />
      </dl>

      <dl className="grid gap-4 border-t border-zinc-800 pt-4 sm:grid-cols-3">
        <SummaryStat
          label="Takip edilen"
          value={
            summary.followingCount === null
              ? "—"
              : formatReportCompactCount(summary.followingCount)
          }
        />
        <SummaryStat
          label="Toplam beğeni"
          value={
            summary.totalLikes === null ? (
              "—"
            ) : (
              <CompactCountText
                value={summary.totalLikes}
                noun="beğeni"
              />
            )
          }
        />
        <SummaryStat
          label="Video sayısı"
          value={
            summary.videoCount === null
              ? "—"
              : formatReportCompactCount(summary.videoCount)
          }
        />
      </dl>
    </section>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-white">{value}</dd>
      {delta ? <div>{delta}</div> : null}
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
