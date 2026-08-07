import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { RunScheduledSyncButton } from "@/features/scheduled-sync/components/run-scheduled-sync-button";
import { formatTurkishDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DashboardHeader({
  syncConfigured,
  videoAddHref,
}: {
  syncConfigured: boolean;
  videoAddHref: string;
}) {
  const today = formatTurkishDate(new Date().toISOString());

  return (
    <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs text-zinc-500">{today}</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          BeFluencer Yönetim Paneli
        </h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">
          Kampanyaları, içerikleri, senkronizasyonları ve raporları tek yerden
          yönetin.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/campaigns/new"
          className={cn(
            buttonVariants({ size: "sm" }),
            "bg-orange-500 text-white hover:bg-orange-500/90"
          )}
        >
          Yeni Kampanya
        </Link>
        <Link
          href="/creators/new"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Creator Ekle
        </Link>
        <Link
          href={videoAddHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Video Ekle
        </Link>
        <Link
          href="/reports"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Raporları Görüntüle
        </Link>
        <RunScheduledSyncButton syncConfigured={syncConfigured} />
      </div>
    </header>
  );
}
