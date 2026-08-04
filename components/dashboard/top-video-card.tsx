import {
  Eye,
  Heart,
  MessageCircle,
  Play,
  Share2,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCompact, formatPercent, formatShortDate } from "@/lib/format";
import type { Video } from "@/lib/types";

interface TopVideoCardProps {
  video: Video;
  rank?: number;
}

const platformLabels: Record<Video["platform"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

export function TopVideoCard({ video, rank = 1 }: TopVideoCardProps) {
  return (
    <Card className="overflow-hidden border-white/8 bg-[#111113] py-0 ring-0">
      <CardContent className="p-0">
        <div className="grid md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr]">
          <div className="relative aspect-[3/4] w-full md:aspect-auto md:min-h-[320px]">
            <Image
              src={video.thumbnail}
              alt={video.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 240px"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent md:bg-gradient-to-r" />
            <div className="absolute top-3 left-3">
              <Badge
                variant="outline"
                className="border-white/20 bg-black/50 text-white backdrop-blur-sm"
              >
                #{rank} Top Video
              </Badge>
            </div>
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
              <Play className="size-3 fill-white" />
              {platformLabels[video.platform]}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6 p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">
                  {video.title}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {video.creatorHandle} · {video.creatorName}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Published {formatShortDate(video.publishedAt)}
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                <TrendingUp className="size-3" />
                {formatPercent(video.engagementRate)} engagement rate
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBlock icon={Eye} label="Views" value={formatCompact(video.views)} />
              <StatBlock icon={Heart} label="Likes" value={formatCompact(video.likes)} />
              <StatBlock
                icon={MessageCircle}
                label="Comments"
                value={formatCompact(video.comments)}
              />
              <StatBlock
                icon={Share2}
                label="Shares"
                value={formatCompact(video.shares)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/6 bg-white/3 px-3 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-zinc-500">
        <Icon className="size-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}
