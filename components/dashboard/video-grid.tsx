import { Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompact, formatShortDate } from "@/lib/format";
import type { Video } from "@/lib/types";

interface VideoGridProps {
  videos: Video[];
}

const platformLabels: Record<Video["platform"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

export function VideoGrid({ videos }: VideoGridProps) {
  return (
    <Card className="border-white/8 bg-[#111113] py-0 ring-0">
      <CardHeader className="border-b border-white/6 pb-4">
        <CardTitle className="text-sm font-medium text-zinc-200">
          All Videos
        </CardTitle>
        <p className="text-xs text-zinc-500">
          {videos.length} videos in this campaign
        </p>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <VideoGridItem key={video.id} video={video} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function VideoGridItem({ video }: { video: Video }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-white/8 bg-[#0C0C0E] transition-colors hover:border-white/15">
      <div className="relative aspect-[9/16] overflow-hidden">
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        <div className="absolute top-2.5 left-2.5">
          <Badge
            variant="outline"
            className="border-white/20 bg-black/50 text-[10px] text-white backdrop-blur-sm"
          >
            {platformLabels[video.platform]}
          </Badge>
        </div>

        <div className="absolute right-2.5 bottom-2.5 left-2.5">
          <p className="line-clamp-2 text-sm font-medium text-white">
            {video.title}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{video.creatorHandle}</p>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{formatShortDate(video.publishedAt)}</span>
          <span className="flex items-center gap-1 font-medium text-white tabular-nums">
            <Eye className="size-3" />
            {formatCompact(video.views)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-white/6 pt-3">
          <MiniStat icon={Heart} value={formatCompact(video.likes)} />
          <MiniStat icon={MessageCircle} value={formatCompact(video.comments)} />
          <MiniStat icon={Share2} value={formatCompact(video.shares)} />
        </div>
      </div>
    </article>
  );
}

function MiniStat({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  return (
    <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
      <Icon className="size-3 shrink-0" />
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
