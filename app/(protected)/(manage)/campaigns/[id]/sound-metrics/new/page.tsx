import Link from "next/link";
import { notFound } from "next/navigation";

import { getCampaignById } from "@/features/campaigns/queries";
import { createSoundMetricSnapshot } from "@/features/metrics/actions";
import { defaultSoundMetricFormValues } from "@/features/metrics/schemas";
import { SoundMetricForm } from "@/features/metrics/components/sound-metric-form";

export default async function NewSoundMetricPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);

  if (!campaign) {
    notFound();
  }

  const createMetric = createSoundMetricSnapshot.bind(null, id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/campaigns/${id}#sound-tracking`}
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Kampanyaya dön
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          Ses Kullanımı Ekle
        </h1>
        <p className="mt-1 text-sm text-zinc-400">{campaign.name}</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <SoundMetricForm
          action={createMetric}
          defaultValues={defaultSoundMetricFormValues()}
          cancelHref={`/campaigns/${id}#metrics`}
        />
      </div>
    </div>
  );
}
