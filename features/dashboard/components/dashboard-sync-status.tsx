import Link from "next/link";

import { summarizeLatestSync } from "@/features/dashboard/calculations";
import { RunScheduledSyncButton } from "@/features/scheduled-sync/components/run-scheduled-sync-button";
import type { ScheduledSyncRunRow } from "@/features/scheduled-sync/types";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DashboardSyncStatus({
  latestSync,
  recentFailedSyncs,
  syncConfigured,
}: {
  latestSync: ScheduledSyncRunRow | null;
  recentFailedSyncs: ScheduledSyncRunRow[];
  syncConfigured: boolean;
}) {
  const summary = summarizeLatestSync(latestSync);

  return (
    <section
      aria-labelledby="dashboard-sync-heading"
      className="rounded-xl border border-zinc-800 bg-zinc-950/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <h2
          id="dashboard-sync-heading"
          className="text-sm font-medium text-white"
        >
          Senkronizasyon durumu
        </h2>
        <Link
          href="/settings/sync"
          className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Senkron geçmişi
        </Link>
      </div>

      <div className="space-y-4 px-4 py-4">
        {!summary.hasRun ? (
          <p className="text-sm text-zinc-500">{summary.statusLabel}</p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Durum</dt>
              <dd className="mt-0.5 text-zinc-200">{summary.statusLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Tetikleyici</dt>
              <dd className="mt-0.5 text-zinc-200">{summary.triggerLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Başlangıç</dt>
              <dd className="mt-0.5 text-zinc-200">
                {formatDateTime(latestSync!.started_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Bitiş</dt>
              <dd className="mt-0.5 text-zinc-200">
                {formatDateTime(latestSync!.completed_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Kampanyalar</dt>
              <dd className="mt-0.5 text-zinc-200">
                {latestSync!.successful_campaigns}/
                {latestSync!.total_campaigns} başarılı
                {latestSync!.failed_campaigns > 0
                  ? ` · ${latestSync!.failed_campaigns} başarısız`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Video / Profil / Ses</dt>
              <dd className="mt-0.5 text-zinc-200">
                {latestSync!.video_success}/{latestSync!.video_failed} ·{" "}
                {latestSync!.creator_success}/{latestSync!.creator_failed} ·{" "}
                {latestSync!.sound_success}/{latestSync!.sound_failed}
              </dd>
            </div>
          </dl>
        )}

        {latestSync?.error_message ? (
          <p className="text-xs text-red-400">{latestSync.error_message}</p>
        ) : null}

        {recentFailedSyncs.length > 0 ? (
          <div>
            <p className="text-xs text-zinc-500">Son sorunlu çalıştırmalar</p>
            <ul className="mt-1 space-y-1 text-xs text-zinc-400">
              {recentFailedSyncs.slice(0, 3).map((run) => (
                <li key={run.id}>
                  {formatDateTime(run.started_at)} — {run.status}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <RunScheduledSyncButton syncConfigured={syncConfigured} />
      </div>
    </section>
  );
}
