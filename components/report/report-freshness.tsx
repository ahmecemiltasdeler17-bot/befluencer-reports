import type { ReportFreshness } from "@/features/reports/types";
import { formatTurkishDate } from "@/lib/format";

export function ReportFreshnessIndicator({
  freshness,
}: {
  freshness: ReportFreshness;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-zinc-500 min-[1100px]:justify-end">
      <FreshnessItem
        label="Son veri güncelleme"
        value={
          freshness.lastSuccessfulSyncAt
            ? formatTurkishDate(freshness.lastSuccessfulSyncAt)
            : "—"
        }
      />
      <FreshnessItem
        label="Metriksiz içerik"
        value={String(freshness.videosWithoutMetrics)}
      />
      <FreshnessItem
        label="Güncelliğini yitirmiş içerik"
        value={String(freshness.staleVideoCount)}
      />
    </div>
  );
}

function FreshnessItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="tracking-[0.12em] uppercase">{label}</span>
      <span className="font-medium text-zinc-400 tabular-nums">{value}</span>
    </div>
  );
}
