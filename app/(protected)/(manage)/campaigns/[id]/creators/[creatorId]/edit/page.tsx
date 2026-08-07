import Link from "next/link";
import { notFound } from "next/navigation";

import { getCampaignById } from "@/features/campaigns/queries";
import { updateCampaignCreator } from "@/features/creators/actions";
import { AssignCreatorForm } from "@/features/creators/components/assign-creator-form";
import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import { CreatorCategoryBadge } from "@/features/creators/components/creator-category-badge";
import { CreatorPlatformBadge } from "@/features/creators/components/creator-platform-badge";
import { campaignCreatorToFormValues } from "@/features/creators/schemas";
import { getCampaignCreator } from "@/features/creators/queries";

export default async function EditCampaignCreatorPage({
  params,
}: {
  params: Promise<{ id: string; creatorId: string }>;
}) {
  const { id, creatorId } = await params;
  const [campaign, assignment] = await Promise.all([
    getCampaignById(id),
    getCampaignCreator(id, creatorId),
  ]);

  if (!campaign || !assignment) {
    notFound();
  }

  const updateAssignment = updateCampaignCreator.bind(null, id, creatorId);
  const { creator } = assignment;

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
          Kampanya Atamasını Düzenle
        </h1>
        <p className="mt-1 text-sm text-zinc-400">{campaign.name}</p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <CreatorAvatar
          username={creator.username}
          displayName={creator.display_name}
          avatarUrl={creator.avatar_url}
        />
        <div>
          <p className="font-medium text-white">@{creator.username}</p>
          <p className="text-sm text-zinc-400">
            {creator.display_name ?? "—"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CreatorPlatformBadge platform={creator.platform} />
            <CreatorCategoryBadge category={creator.category} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <AssignCreatorForm
          action={updateAssignment}
          defaultValues={campaignCreatorToFormValues(assignment)}
          submitLabel="Atamayı Kaydet"
          cancelHref={`/campaigns/${campaign.id}`}
        />
      </div>
    </div>
  );
}
