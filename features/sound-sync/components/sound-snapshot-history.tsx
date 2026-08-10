import { DeleteSoundSnapshotButton } from "@/features/sound-sync/components/delete-sound-snapshot-button";
import type { SoundMetricSnapshot } from "@/features/sound-sync/types";
import { formatExactTurkishCount, formatTurkishDate } from "@/lib/format";

const SOURCE_LABELS: Record<SoundMetricSnapshot["source"], string> = {
  manual: "Manuel",
  apify: "Apify",
};

function formatSignedDelta(current: number, previous: number | null): string {
  if (previous === null) {
    return "—";
  }

  const delta = current - previous;
  const body = formatExactTurkishCount(Math.abs(delta));
  if (delta > 0) {
    return `+${body}`;
  }
  if (delta < 0) {
    return `-${body}`;
  }
  return body;
}

export function SoundSnapshotHistory({
  rows,
  title = "Ses Kullanım Geçmişi",
  emptyLabel = "Henüz ses kullanım kaydı yok.",
  showNote = false,
}: {
  rows: SoundMetricSnapshot[];
  title?: string;
  emptyLabel?: string;
  showNote?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="text-base font-medium text-white">{title}</h3>
        <p className="text-sm text-zinc-500">{emptyLabel}</p>
      </section>
    );
  }

  // rows arrive newest-first from the query; previous value is the next row.
  return (
    <section className="space-y-4">
      <h3 className="text-base font-medium text-white">{title}</h3>
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-950/80">
            <tr className="text-left text-zinc-400">
              <th className="px-4 py-3 font-medium">Tarih</th>
              <th className="px-4 py-3 font-medium">Kullanım</th>
              <th className="px-4 py-3 font-medium">Değişim</th>
              <th className="px-4 py-3 font-medium">Kaynak</th>
              {showNote ? (
                <th className="px-4 py-3 font-medium">Not</th>
              ) : null}
              <th className="px-4 py-3 font-medium text-right">Sil</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
            {rows.map((row, index) => {
              const previous = rows[index + 1] ?? null;

              return (
                <tr key={row.id} className="text-zinc-200">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatTurkishDate(row.captured_at)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatExactTurkishCount(row.usage_count)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-400">
                    {formatSignedDelta(
                      row.usage_count,
                      previous?.usage_count ?? null
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {SOURCE_LABELS[row.source] ?? row.source}
                  </td>
                  {showNote ? (
                    <td className="px-4 py-3 text-zinc-500">
                      {row.note?.trim() ? row.note : "—"}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-right">
                    <DeleteSoundSnapshotButton snapshotId={row.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
