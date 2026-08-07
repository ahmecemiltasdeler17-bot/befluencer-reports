import Link from "next/link";
import { notFound } from "next/navigation";

import { createVideoMetricSnapshot } from "@/features/metrics/actions";
import { defaultVideoMetricFormValues } from "@/features/metrics/schemas";
import { VideoMetricForm } from "@/features/metrics/components/video-metric-form";
import { getVideoById } from "@/features/videos/queries";

export default async function NewVideoMetricPage({
  params,
}: {
  params: Promise<{ id: string; videoId: string }>;
}) {
  const { id, videoId } = await params;
  const video = await getVideoById(videoId);

  if (!video || video.campaign_id !== id) {
    notFound();
  }

  if (video.status === "unavailable") {
    return (
      <div className="space-y-4 text-sm text-zinc-400">
        <Link href={`/campaigns/${id}/videos/${videoId}`} className="hover:text-white">
          ← Videoya dön
        </Link>
        <p>Kaldırılmış videolara metrik eklenemez.</p>
      </div>
    );
  }

  const createMetric = createVideoMetricSnapshot.bind(null, id, videoId);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/campaigns/${id}/videos/${videoId}`}
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Videoya dön
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">Metrik Ekle</h1>
        <p className="mt-1 text-sm text-zinc-400">
          @{video.creator.username} — {video.campaign.name}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <VideoMetricForm
          action={createMetric}
          defaultValues={defaultVideoMetricFormValues()}
          cancelHref={`/campaigns/${id}/videos/${videoId}`}
        />
      </div>
    </div>
  );
}
