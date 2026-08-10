import Link from "next/link";

import type { DashboardKpis } from "@/features/dashboard/types";
import { formatManagementCompactCount } from "@/lib/format";

const CARDS: Array<{
  key: keyof DashboardKpis;
  label: string;
  hint: (kpis: DashboardKpis) => string;
  href: string;
}> = [
  {
    key: "activeCampaigns",
    label: "Aktif Kampanyalar",
    hint: (kpis) => `${kpis.totalCampaigns} toplam`,
    href: "/campaigns",
  },
  {
    key: "totalCreators",
    label: "Creatorlar",
    hint: (kpis) => `${kpis.tiktokCreators} TikTok`,
    href: "/creators",
  },
  {
    key: "totalVideos",
    label: "Videolar",
    hint: (kpis) => `${kpis.tiktokVideos} TikTok`,
    href: "/campaigns",
  },
  {
    key: "readyReports",
    label: "Hazır Raporlar",
    hint: () => "Hazır sürümler",
    href: "/reports",
  },
  {
    key: "activeShares",
    label: "Aktif Paylaşım Linkleri",
    hint: () => "İptal/süresi dolmamış",
    href: "/reports",
  },
];

export function DashboardKpiCards({ kpis }: { kpis: DashboardKpis }) {
  return (
    <section aria-labelledby="dashboard-kpis-heading">
      <h2 id="dashboard-kpis-heading" className="sr-only">
        Özet göstergeler
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {CARDS.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="rounded-xl border border-[var(--bf-border)] bg-[var(--bf-surface)] px-4 py-4 transition-colors hover:border-[var(--bf-border-strong)] hover:bg-[var(--bf-elevated)]"
          >
            <p className="text-xs text-[var(--bf-text-muted)]">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--bf-text)]">
              {formatManagementCompactCount(kpis[card.key])}
            </p>
            <p className="mt-1 text-[11px] text-[var(--bf-text-secondary)]">
              {card.hint(kpis)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
