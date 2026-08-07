import { DeleteMetricSnapshotButton } from "@/features/metrics/components/delete-metric-snapshot-button";
import type { SoundMetricSnapshot } from "@/features/metrics/types";
import { formatTurkishDate, formatTurkishReport } from "@/lib/format";

export function SoundMetricHistory({
  rows,
}: {
  rows: SoundMetricSnapshot[];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h3 className="text-base font-medium text-white">Ses Kullanım Geçmişi</h3>
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-950/80">
            <tr className="text-left text-zinc-400">
              <th className="px-4 py-3 font-medium">Tarih</th>
              <th className="px-4 py-3 font-medium">Kullanım Sayısı</th>
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
                  {formatTurkishReport(row.usage_count)}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteMetricSnapshotButton snapshotId={row.id} type="sound" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
