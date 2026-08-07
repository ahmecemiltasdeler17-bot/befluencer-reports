import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { MetricDelta } from "@/features/metrics/components/metric-delta";
import type { VideoMetricSummary } from "@/features/metrics/types";
import { formatTurkishReport, formatTurkishPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function VideoMetricSummaryPanel({
  campaignId,
  videoId,
  summary,
}: {
  campaignId: string;
  videoId: string;
  summary: VideoMetricSummary;
}) {
  if (!summary.latest) {
    return (
      <section className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-white">Metrikler</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Bu video için henüz metrik kaydı yok.
            </p>
          </div>
          <Link
            href={`/campaigns/${campaignId}/videos/${videoId}/metrics/new`}
            className={cn(
              buttonVariants({ variant: "default" }),
              "bg-orange-500 text-white hover:bg-orange-500/90"
            )}
          >
            Metrik Ekle
          </Link>
        </div>
      </section>
    );
  }

  const { latest, deltas, growthPercentage } = summary;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-white">Metrikler</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Son güncelleme: {formatDateTime(latest.captured_at)}
          </p>
        </div>
        <Link
          href={`/campaigns/${campaignId}/videos/${videoId}/metrics/new`}
          className={cn(
            buttonVariants({ variant: "default" }),
            "bg-orange-500 text-white hover:bg-orange-500/90"
          )}
        >
          Metrik Ekle
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="İzlenme" value={formatTurkishReport(latest.views)} delta={deltas?.views} growth={growthPercentage} />
        <MetricCard label="Beğeni" value={formatTurkishReport(latest.likes)} delta={deltas?.likes} />
        <MetricCard label="Yorum" value={formatTurkishReport(latest.comments)} delta={deltas?.comments} />
        <MetricCard label="Paylaşım" value={formatTurkishReport(latest.shares)} delta={deltas?.shares} />
        <MetricCard label="Kaydetme" value={formatTurkishReport(latest.saves)} delta={deltas?.saves} />
        <MetricCard
          label="Etkileşim oranı"
          value={formatTurkishPercent(summary.engagementRate)}
        />
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  delta,
  growth,
}: {
  label: string;
  value: string;
  delta?: number;
  growth?: number | null;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-medium text-white tabular-nums">{value}</p>
      {delta !== undefined ? (
        <div className="mt-2">
          <MetricDelta
            value={delta}
            percentage={label === "İzlenme" ? growth : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
