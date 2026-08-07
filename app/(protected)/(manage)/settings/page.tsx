import Link from "next/link";

import { RunScheduledSyncButton } from "@/features/scheduled-sync/components/run-scheduled-sync-button";
import { getLatestScheduledSyncRun } from "@/features/scheduled-sync/queries";
import { isScheduledSyncConfigured } from "@/lib/env.server";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Henüz çalıştırılmadı";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function SettingsPage() {
  const latest = await getLatestScheduledSyncRun();
  const syncConfigured = isScheduledSyncConfigured();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Ayarlar</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Uygulama yapılandırması ve senkronizasyon kontrolleri.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium text-white">
              TikTok otomatik senkron
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Son çalıştırma:{" "}
              {formatDateTime(latest?.completed_at ?? latest?.started_at ?? null)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/settings/sync"
              className="text-sm text-orange-400 hover:text-orange-300"
            >
              Geçmişi gör
            </Link>
            <RunScheduledSyncButton syncConfigured={syncConfigured} />
          </div>
        </div>
      </section>
    </div>
  );
}
