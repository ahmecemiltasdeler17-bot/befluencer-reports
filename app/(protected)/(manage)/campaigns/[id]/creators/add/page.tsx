import Link from "next/link";
import { notFound } from "next/navigation";

import {
  assignCreatorToCampaign,
  createCreatorAndAssignToCampaign,
} from "@/features/creators/actions";
import { AddCreatorTabs } from "@/features/creators/components/add-creator-tabs";
import { CreatorForm } from "@/features/creators/components/creator-form";
import { CreatorSearch } from "@/features/creators/components/creator-search";
import { getCampaignById } from "@/features/campaigns/queries";
import { listCampaignCreators } from "@/features/creators/queries";

export default async function AddCampaignCreatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [campaign, assignments] = await Promise.all([
    getCampaignById(id),
    listCampaignCreators(id),
  ]);

  if (!campaign) {
    notFound();
  }

  const excludeCreatorIds = assignments.map((item) => item.creator_id);
  const createAndAssign = createCreatorAndAssignToCampaign.bind(null, id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/campaigns/${campaign.id}`}
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Kampanyaya dön
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          İçerik Üreticisi Ekle
        </h1>
        <p className="mt-1 text-sm text-zinc-400">{campaign.name}</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <AddCreatorTabs
          existingPanel={
            <CreatorSearch
              campaignId={campaign.id}
              assignAction={assignCreatorToCampaign}
              excludeCreatorIds={excludeCreatorIds}
              cancelHref={`/campaigns/${campaign.id}`}
            />
          }
          newPanel={
            <CreatorForm
              action={createAndAssign}
              submitLabel="Oluştur ve Kampanyaya Ekle"
              cancelHref={`/campaigns/${campaign.id}`}
              includeCampaignFields
            />
          }
        />
      </div>
    </div>
  );
}
