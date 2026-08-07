import Link from "next/link";
import { notFound } from "next/navigation";

import { updateCampaign } from "@/features/campaigns/actions";
import { CampaignForm } from "@/features/campaigns/components/campaign-form";
import { campaignToFormValues } from "@/features/campaigns/schemas";
import { getCampaignById } from "@/features/campaigns/queries";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);

  if (!campaign) {
    notFound();
  }

  const updateCampaignWithId = updateCampaign.bind(null, id);

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
          Kampanyayı Düzenle
        </h1>
        <p className="mt-1 text-sm text-zinc-400">{campaign.name}</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <CampaignForm
          action={updateCampaignWithId}
          defaultValues={campaignToFormValues(campaign)}
          submitLabel="Değişiklikleri Kaydet"
          cancelHref={`/campaigns/${campaign.id}`}
        />
      </div>
    </div>
  );
}
