import Link from "next/link";
import { notFound } from "next/navigation";

import { getCampaignById } from "@/features/campaigns/queries";
import { listCampaignCreators } from "@/features/creators/queries";
import { updateVideo } from "@/features/videos/actions";
import { VideoForm } from "@/features/videos/components/video-form";
import { videoToFormValues } from "@/features/videos/schemas";
import { getVideoById } from "@/features/videos/queries";

export default async function EditCampaignVideoPage({
  params,
}: {
  params: Promise<{ id: string; videoId: string }>;
}) {
  const { id, videoId } = await params;
  const [campaign, assignments, video] = await Promise.all([
    getCampaignById(id),
    listCampaignCreators(id),
    getVideoById(videoId),
  ]);

  if (!campaign || !video || video.campaign_id !== id) {
    notFound();
  }

  const creators = assignments.map((item) => ({
    id: item.creator.id,
    username: item.creator.username,
    display_name: item.creator.display_name,
  }));

  const updateVideoAction = updateVideo.bind(null, id, videoId);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/campaigns/${id}/videos/${videoId}`}
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Videoya dön
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          Videoyu Düzenle
        </h1>
        <p className="mt-1 text-sm text-zinc-400">{campaign.name}</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <VideoForm
          action={updateVideoAction}
          creators={creators}
          defaultValues={videoToFormValues(video)}
          submitLabel="Değişiklikleri Kaydet"
          cancelHref={`/campaigns/${id}/videos/${videoId}`}
        />
      </div>
    </div>
  );
}
