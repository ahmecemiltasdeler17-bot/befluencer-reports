import Link from "next/link";
import { notFound } from "next/navigation";

import { getCampaignById } from "@/features/campaigns/queries";
import { listCampaignCreators } from "@/features/creators/queries";
import { createVideo } from "@/features/videos/actions";
import { VideoForm } from "@/features/videos/components/video-form";

export default async function NewCampaignVideoPage({
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

  const creators = assignments.map((item) => ({
    id: item.creator.id,
    username: item.creator.username,
    display_name: item.creator.display_name,
  }));

  const createVideoAction = createVideo.bind(null, id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/campaigns/${campaign.id}#videos`}
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Kampanyaya dön
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">Video Ekle</h1>
        <p className="mt-1 text-sm text-zinc-400">{campaign.name}</p>
      </div>

      {creators.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 px-6 py-10 text-center text-sm text-zinc-400">
          Video eklemek için önce kampanyaya en az bir içerik üreticisi
          atamalısınız.{" "}
          <Link
            href={`/campaigns/${campaign.id}/creators/add`}
            className="text-primary hover:text-[var(--bf-accent-soft)]"
          >
            İçerik üreticisi ekle
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
          <VideoForm
            action={createVideoAction}
            creators={creators}
            submitLabel="Videoyu Kaydet"
            cancelHref={`/campaigns/${campaign.id}#videos`}
          />
        </div>
      )}
    </div>
  );
}
