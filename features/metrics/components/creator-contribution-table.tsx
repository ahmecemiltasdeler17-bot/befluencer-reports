import Link from "next/link";

import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import type { CreatorMetricSummaryRow } from "@/features/metrics/types";
import { formatTurkishPercent, formatTurkishReport } from "@/lib/format";

export function CreatorContributionTable({
  rows,
}: {
  rows: CreatorMetricSummaryRow[];
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-800 px-6 py-10 text-center text-sm text-zinc-400">
        Katkı tablosu için metrikli video gerekir.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-base font-medium text-white">
        İçerik Üreticisi Katkısı
      </h3>
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-950/80">
            <tr className="text-left text-zinc-400">
              <th className="px-4 py-3 font-medium">İçerik Üreticisi</th>
              <th className="px-4 py-3 font-medium">Video</th>
              <th className="px-4 py-3 font-medium">Toplam İzlenme</th>
              <th className="px-4 py-3 font-medium">Katkı</th>
              <th className="px-4 py-3 font-medium">Etkileşim Oranı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
            {rows.map((row) => (
              <tr key={row.creatorId} className="text-zinc-200">
                <td className="px-4 py-3">
                  <Link
                    href={`/creators/${row.creatorId}`}
                    className="flex items-center gap-3 hover:text-white"
                  >
                    <CreatorAvatar
                      username={row.username}
                      displayName={row.displayName}
                      avatarUrl={row.avatarUrl}
                      size="sm"
                    />
                    <span>@{row.username}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 tabular-nums">{row.videoCount}</td>
                <td className="px-4 py-3 tabular-nums">
                  {formatTurkishReport(row.latestTotalViews)}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatTurkishPercent(row.contributionPercentage)}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatTurkishPercent(row.engagementRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
