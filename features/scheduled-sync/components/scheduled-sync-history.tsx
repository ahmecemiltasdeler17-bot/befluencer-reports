import Link from "next/link";

import type { ScheduledSyncRunRow } from "@/features/scheduled-sync/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ScheduledSyncRunRow["status"], string> = {
  running: "Çalışıyor",
  success: "Başarılı",
  partial: "Kısmi",
  failed: "Başarısız",
  skipped: "Atlandı",
};

const STATUS_TONES: Record<ScheduledSyncRunRow["status"], string> = {
  running: "text-amber-400",
  success: "text-emerald-400",
  partial: "text-orange-400",
  failed: "text-red-400",
  skipped: "text-zinc-400",
};

const TRIGGER_LABELS: Record<ScheduledSyncRunRow["triggered_by"], string> = {
  cron: "Zamanlanmış",
  manual: "Manuel",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ScheduledSyncHistory({
  runs,
}: {
  runs: ScheduledSyncRunRow[];
}) {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Henüz zamanlanmış senkron kaydı yok.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-950/80">
          <tr className="text-left text-zinc-400">
            <th className="px-4 py-3 font-medium">Durum</th>
            <th className="px-4 py-3 font-medium">Kaynak</th>
            <th className="px-4 py-3 font-medium">Başlangıç</th>
            <th className="px-4 py-3 font-medium">Bitiş</th>
            <th className="px-4 py-3 font-medium">Kampanya</th>
            <th className="px-4 py-3 font-medium">Video</th>
            <th className="px-4 py-3 font-medium">Profil</th>
            <th className="px-4 py-3 font-medium">Ses</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
          {runs.map((run) => (
            <tr key={run.id} className="text-zinc-200">
              <td className={cn("px-4 py-3", STATUS_TONES[run.status])}>
                {STATUS_LABELS[run.status]}
                {run.error_message ? (
                  <p className="mt-1 max-w-[220px] text-xs text-red-400/90">
                    {run.error_message}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-zinc-400">
                {TRIGGER_LABELS[run.triggered_by]}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {formatDateTime(run.started_at)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {formatDateTime(run.completed_at)}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {run.successful_campaigns}/{run.total_campaigns}
                {run.failed_campaigns > 0
                  ? ` · ${run.failed_campaigns} hata`
                  : ""}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {run.video_success}/{run.video_failed}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {run.creator_success}/{run.creator_failed}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {run.sound_success}/{run.sound_failed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-500">
        Ayrıntılı video/profil/ses işleri kampanya sayfalarındaki{" "}
        <Link href="/campaigns" className="text-orange-400 hover:text-orange-300">
          senkron geçmişinde
        </Link>{" "}
        görünür.
      </p>
    </div>
  );
}
