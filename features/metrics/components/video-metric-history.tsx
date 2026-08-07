import { DeleteMetricSnapshotButton } from "@/features/metrics/components/delete-metric-snapshot-button";
import { MetricDelta } from "@/features/metrics/components/metric-delta";
import type { VideoMetricHistoryRow } from "@/features/metrics/types";
import { formatTurkishDate, formatTurkishPercent, formatTurkishReport } from "@/lib/format";

export function VideoMetricHistory({
  rows,
}: {
  rows: VideoMetricHistoryRow[];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h3 className="text-base font-medium text-white">Metrik Geçmişi</h3>
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950/80">
              <tr className="text-left text-zinc-400">
                <th className="px-4 py-3 font-medium">Tarih</th>
                <th className="px-4 py-3 font-medium">İzlenme</th>
                <th className="px-4 py-3 font-medium">Beğeni</th>
                <th className="px-4 py-3 font-medium">Yorum</th>
                <th className="px-4 py-3 font-medium">Paylaşım</th>
                <th className="px-4 py-3 font-medium">Kaydetme</th>
                <th className="px-4 py-3 font-medium">Etkileşim Oranı</th>
                <th className="px-4 py-3 font-medium">Değişim</th>
                <th className="px-4 py-3 font-medium text-right">Sil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
              {rows.map((row) => (
                <tr key={row.id} className="text-zinc-200">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatTurkishDate(row.captured_at)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatTurkishReport(row.views)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatTurkishReport(row.likes)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatTurkishReport(row.comments)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatTurkishReport(row.shares)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatTurkishReport(row.saves)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatTurkishPercent(row.engagementRate)}
                  </td>
                  <td className="px-4 py-3">
                    {row.deltas ? (
                      <MetricDelta value={row.deltas.views} />
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteMetricSnapshotButton snapshotId={row.id} type="video" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
