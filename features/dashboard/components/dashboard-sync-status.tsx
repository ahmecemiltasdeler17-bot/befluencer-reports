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
      className="admin-panel overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--bf-border)] px-4 py-3">
        <h2
          id="dashboard-sync-heading"
          className="text-sm font-medium text-[var(--bf-text)]"
        >
          Senkronizasyon durumu
        </h2>
        <Link
          href="/settings/sync"
          className="text-xs text-[var(--bf-text-muted)] transition-colors hover:text-[var(--bf-text-secondary)]"
        >
          Senkron geçmişi
        </Link>
      </div>

      <div className="space-y-4 px-4 py-4">
        {!summary.hasRun ? (
          <p className="text-sm text-[var(--bf-text-muted)]">
            {summary.statusLabel}
          </p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--bf-text-muted)]">Durum</dt>
              <dd className="mt-0.5 text-[var(--bf-text)]">
                {summary.statusLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--bf-text-muted)]">Tetikleyici</dt>
              <dd className="mt-0.5 text-[var(--bf-text)]">
                {summary.triggerLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--bf-text-muted)]">Başlangıç</dt>
              <dd className="mt-0.5 text-[var(--bf-text)]">
                {formatDateTime(latestSync!.started_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--bf-text-muted)]">Bitiş</dt>
              <dd className="mt-0.5 text-[var(--bf-text)]">
                {formatDateTime(latestSync!.completed_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--bf-text-muted)]">Kampanyalar</dt>
              <dd className="mt-0.5 text-[var(--bf-text)]">
                {latestSync!.successful_campaigns}/
                {latestSync!.total_campaigns} başarılı
                {latestSync!.failed_campaigns > 0
                  ? ` · ${latestSync!.failed_campaigns} başarısız`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--bf-text-muted)]">
                Video / Profil / Ses
              </dt>
              <dd className="mt-0.5 text-[var(--bf-text)]">
                {latestSync!.video_success}/{latestSync!.video_failed} ·{" "}
                {latestSync!.creator_success}/{latestSync!.creator_failed} ·{" "}
                {latestSync!.sound_success}/{latestSync!.sound_failed}
              </dd>
            </div>
          </dl>
        )}

        {latestSync?.error_message ? (
          <p className="text-xs text-[var(--bf-destructive)]">
            {latestSync.error_message}
          </p>
        ) : null}

        {recentFailedSyncs.length > 0 ? (
          <div>
            <p className="text-xs text-[var(--bf-text-muted)]">
              Son sorunlu çalıştırmalar
            </p>
            <ul className="mt-1 space-y-1 text-xs text-[var(--bf-text-secondary)]">
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
