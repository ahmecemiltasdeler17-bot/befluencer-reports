import type { CampaignMetricTimelineRow } from "@/features/metrics/types";
import { formatTurkishDate, formatTurkishReport } from "@/lib/format";

export function CampaignMetricTimeline({
  rows,
}: {
  rows: CampaignMetricTimelineRow[];
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-800 px-6 py-10 text-center text-sm text-zinc-400">
        Zaman çizelgesi için metrik kaydı gerekir.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-base font-medium text-white">Metrik Zaman Çizelgesi</h3>
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-950/80">
            <tr className="text-left text-zinc-400">
              <th className="px-4 py-3 font-medium">Tarih</th>
              <th className="px-4 py-3 font-medium">Toplam İzlenme</th>
              <th className="px-4 py-3 font-medium">Toplam Etkileşim</th>
              <th className="px-4 py-3 font-medium">Metrikli Video</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
            {rows.map((row) => (
              <tr key={row.date} className="text-zinc-200">
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatTurkishDate(row.date)}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatTurkishReport(row.totalViews)}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatTurkishReport(row.totalEngagement)}
                </td>
                <td className="px-4 py-3 tabular-nums">{row.videoCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
