import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { CampaignEmptyState } from "@/features/campaigns/components/campaign-empty-state";
import { CampaignList } from "@/features/campaigns/components/campaign-list";
import { listCampaigns } from "@/features/campaigns/queries";
import { cn } from "@/lib/utils";

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Kampanyalar</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Müzik kampanyalarını oluştur, düzenle ve takip et
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className={cn(
            buttonVariants({ variant: "default" }),
            "bg-orange-500 text-white hover:bg-orange-500/90"
          )}
        >
          Yeni Kampanya
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <CampaignEmptyState />
      ) : (
        <CampaignList campaigns={campaigns} />
      )}
    </div>
  );
}
