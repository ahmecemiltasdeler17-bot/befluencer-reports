import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import type { DashboardCampaignRow } from "@/features/dashboard/types";
import { formatManagementCompactCount } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatActivity(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DashboardCampaignOverview({
  campaigns,
}: {
  campaigns: DashboardCampaignRow[];
}) {
  return (
    <section
      aria-labelledby="dashboard-campaigns-heading"
      className="admin-panel overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-[var(--bf-border)] px-4 py-3">
        <h2
          id="dashboard-campaigns-heading"
          className="text-sm font-medium text-[var(--bf-text)]"
        >
          Kampanya özeti
        </h2>
        <Link
          href="/campaigns"
          className="text-xs text-[var(--bf-text-muted)] transition-colors hover:text-[var(--bf-text-secondary)]"
        >
          Tümü
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-[var(--bf-text)]">
            Henüz kampanya yok
          </p>
          <p className="mt-1 text-xs text-[var(--bf-text-muted)]">
            İlk kampanyanızı oluşturarak başlayın.
          </p>
          <Link
            href="/campaigns/new"
            className={cn(
              buttonVariants({ size: "sm" }),
              "mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Yeni Kampanya
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table w-full min-w-[720px] text-left text-sm">
            <thead className="text-[11px] tracking-wide text-[var(--bf-text-muted)] uppercase">
              <tr className="border-b border-[var(--bf-border)]">
                <th className="px-4 py-2 font-medium">Kampanya</th>
                <th className="px-4 py-2 font-medium">Durum</th>
                <th className="px-4 py-2 font-medium">Üretici</th>
                <th className="px-4 py-2 font-medium">Video</th>
                <th className="px-4 py-2 font-medium">Ses</th>
                <th className="px-4 py-2 font-medium">Rapor</th>
                <th className="px-4 py-2 font-medium">Aktivite</th>
                <th className="px-4 py-2 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--bf-border)]">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="text-[var(--bf-text-secondary)]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--bf-text)]">
                      {campaign.name}
                    </p>
                    {campaign.reportNumber ? (
                      <p className="text-[11px] text-[var(--bf-text-muted)]">
                        {campaign.reportNumber}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <CampaignStatusBadge status={campaign.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {campaign.creatorCount}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {campaign.videoCount}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {campaign.latestSoundUsage != null
                      ? formatManagementCompactCount(campaign.latestSoundUsage)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {campaign.latestReportVersion != null
                      ? `v${campaign.latestReportVersion}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--bf-text-muted)]">
                    {formatActivity(campaign.lastActivityAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" })
                        )}
                      >
                        Kampanyayı Aç
                      </Link>
                      <Link
                        href={`/campaigns/${campaign.id}/report`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" })
                        )}
                      >
                        Canlı Rapor
                      </Link>
                      <Link
                        href={`/campaigns/${campaign.id}/reports`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" })
                        )}
                      >
                        Rapor Geçmişi
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
