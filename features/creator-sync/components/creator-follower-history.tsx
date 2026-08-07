import { DeleteCreatorSnapshotButton } from "@/features/creator-sync/components/delete-creator-snapshot-button";
import type { CreatorMetricHistoryRow } from "@/features/creator-sync/types";
import { MetricDelta } from "@/features/metrics/components/metric-delta";
import { formatTurkishDate, formatExactTurkishCount } from "@/lib/format";

/**
 * Newest-first follower history. Rows arrive already ordered and already carrying
 * their delta, so this component only formats.
 */
export function CreatorFollowerHistory({
  rows,
}: {
  rows: CreatorMetricHistoryRow[];
}) {
  if (rows.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="text-base font-medium text-white">Takipçi Geçmişi</h3>
        <div className="rounded-lg border border-dashed border-zinc-800 px-6 py-10 text-center text-sm text-zinc-400">
          Henüz takipçi kaydı yok. Profili güncelleyerek ilk kaydı oluşturun.
        </div>
      </section>
    );
  }

  // Rows are newest first, so the baseline is the last one.
  const baselineId = rows[rows.length - 1]?.id;

  return (
    <section className="space-y-4">
      <h3 className="text-base font-medium text-white">Takipçi Geçmişi</h3>
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950/80">
              <tr className="text-left text-zinc-400">
                <th className="px-4 py-3 font-medium">Tarih</th>
                <th className="px-4 py-3 font-medium">Takipçi</th>
                <th className="px-4 py-3 font-medium">Değişim</th>
                <th className="px-4 py-3 font-medium">Takip edilen</th>
                <th className="px-4 py-3 font-medium">Toplam beğeni</th>
                <th className="px-4 py-3 font-medium">Video sayısı</th>
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
                    {formatExactTurkishCount(row.follower_count)}
                  </td>
                  <td className="px-4 py-3">
                    {row.followerDelta === null ? (
                      <span className="text-zinc-500">—</span>
                    ) : (
                      <MetricDelta
                        value={row.followerDelta}
                        percentage={row.followerDeltaPercentage}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.following_count === null
                      ? "—"
                      : formatExactTurkishCount(row.following_count)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.total_likes === null
                      ? "—"
                      : formatExactTurkishCount(row.total_likes)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.video_count === null
                      ? "—"
                      : formatExactTurkishCount(row.video_count)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteCreatorSnapshotButton
                      snapshotId={row.id}
                      isBaseline={row.id === baselineId}
                    />
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
