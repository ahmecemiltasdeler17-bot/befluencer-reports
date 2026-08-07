import type { CampaignMetricSummary } from "@/features/metrics/types";
import { formatTurkishPercent, formatTurkishReport } from "@/lib/format";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CampaignMetricSummaryPanel({
  summary,
}: {
  summary: CampaignMetricSummary;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
      <h2 className="text-lg font-medium text-white">Kampanya Metrikleri</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Son veri güncelleme: {formatDateTime(summary.lastUpdatedAt)}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Toplam İzlenme" value={formatTurkishReport(summary.totalViews)} />
        <Stat
          label="Toplam Etkileşim"
          value={formatTurkishReport(summary.totalEngagement)}
        />
        <Stat
          label="Etkileşim Oranı"
          value={formatTurkishPercent(summary.engagementRate)}
        />
        <Stat label="Toplam Video" value={String(summary.totalVideos)} />
        <Stat label="Metrikli Video" value={String(summary.videosWithMetrics)} />
        <Stat label="Metriksiz Video" value={String(summary.videosWithoutMetrics)} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-medium text-white tabular-nums">{value}</p>
    </div>
  );
}
