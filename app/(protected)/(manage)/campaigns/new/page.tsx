import Link from "next/link";

import { createCampaign } from "@/features/campaigns/actions";
import { CampaignForm } from "@/features/campaigns/components/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/campaigns"
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Kampanyalara dön
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          Yeni Kampanya
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Kampanya bilgilerini girin ve kaydedin.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <CampaignForm
          action={createCampaign}
          submitLabel="Kampanyayı Oluştur"
          cancelHref="/campaigns"
        />
      </div>
    </div>
  );
}
