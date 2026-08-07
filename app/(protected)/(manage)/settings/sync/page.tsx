import Link from "next/link";

import { RunScheduledSyncButton } from "@/features/scheduled-sync/components/run-scheduled-sync-button";
import { ScheduledSyncHistory } from "@/features/scheduled-sync/components/scheduled-sync-history";
import { listScheduledSyncRuns } from "@/features/scheduled-sync/queries";
import {
  isCronConfigured,
  isScheduledSyncConfigured,
} from "@/lib/env.server";

export default async function SettingsSyncPage() {
  const runs = await listScheduledSyncRuns(25);
  const syncConfigured = isScheduledSyncConfigured();
  const cronConfigured = isCronConfigured();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/settings"
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Ayarlar
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          TikTok Senkronizasyonu
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Zamanlanmış (6 saatte bir) ve manuel tam senkron çalıştırmaları.
          Rapor sürümleri otomatik üretilmez.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium text-white">Manuel tetikleme</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Tüm uygun kampanyalar için video, profil ve ses senkronunu başlatır.
            </p>
          </div>
          <RunScheduledSyncButton syncConfigured={syncConfigured} />
        </div>

        <ul className="space-y-1 text-sm text-zinc-500">
          <li>
            Servis durumu:{" "}
            {syncConfigured ? (
              <span className="text-emerald-400">Hazır</span>
            ) : (
              <span className="text-amber-400">
                APIFY_* / SUPABASE_SERVICE_ROLE_KEY eksik
              </span>
            )}
          </li>
          <li>
            Cron gizli anahtarı:{" "}
            {cronConfigured ? (
              <span className="text-emerald-400">Tanımlı</span>
            ) : (
              <span className="text-amber-400">CRON_SECRET eksik</span>
            )}
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-medium text-white">Çalıştırma geçmişi</h2>
        <ScheduledSyncHistory runs={runs} />
      </section>
    </div>
  );
}
