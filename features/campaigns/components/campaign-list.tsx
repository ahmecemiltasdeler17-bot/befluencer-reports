import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ArchiveCampaignButton } from "@/features/campaigns/components/archive-campaign-button";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import type { Campaign } from "@/features/campaigns/types";
import { formatTurkishDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return formatTurkishDate(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-950/80">
            <tr className="text-left text-zinc-400">
              <th className="px-4 py-3 font-medium">Kampanya</th>
              <th className="px-4 py-3 font-medium">Sanatçı</th>
              <th className="px-4 py-3 font-medium">Şarkı</th>
              <th className="px-4 py-3 font-medium">Müşteri</th>
              <th className="px-4 py-3 font-medium">Durum</th>
              <th className="px-4 py-3 font-medium">Başlangıç</th>
              <th className="px-4 py-3 font-medium">Bitiş</th>
              <th className="px-4 py-3 font-medium">Rapor No</th>
              <th className="px-4 py-3 font-medium">Oluşturulma</th>
              <th className="px-4 py-3 font-medium text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
            {campaigns.map((campaign) => (
              <tr key={campaign.id} className="text-zinc-200">
                <td className="px-4 py-3 font-medium text-white">
                  {campaign.name}
                </td>
                <td className="px-4 py-3">{campaign.artist_name}</td>
                <td className="px-4 py-3">{campaign.track_name}</td>
                <td className="px-4 py-3">{campaign.client_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <CampaignStatusBadge status={campaign.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatDate(campaign.start_date)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatDate(campaign.end_date)}
                </td>
                <td className="px-4 py-3">{campaign.report_number ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatDateTime(campaign.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      Aç
                    </Link>
                    <Link
                      href={`/campaigns/${campaign.id}/edit`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Düzenle
                    </Link>
                    {campaign.status !== "archived" ? (
                      <ArchiveCampaignButton
                        campaignId={campaign.id}
                        campaignName={campaign.name}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
