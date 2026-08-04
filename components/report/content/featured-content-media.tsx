import { Play } from "lucide-react";

import { PLATFORM_LABELS } from "@/lib/content-helpers";
import type { Video } from "@/lib/types";

import { SafeThumbnail } from "./safe-media";

interface FeaturedContentMediaProps {
  video: Video;
}

export function FeaturedContentMedia({ video }: FeaturedContentMediaProps) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[330px] overflow-hidden rounded-[18px] bg-zinc-900 min-[800px]:mx-0">
      <SafeThumbnail
        src={video.thumbnail}
        seed={video.id}
        name={video.creatorName}
        username={video.creatorHandle}
        title={video.title}
        platform={video.platform}
        featured
        sizes="330px"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />

      <div className="absolute top-4 left-4">
        <span className="rounded-full bg-[#FF5A00] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white uppercase">
          En Yüksek Erişim
        </span>
      </div>

      <div className="absolute top-4 right-4">
        <div className="flex size-9 items-center justify-center rounded-full bg-black/50 ring-1 ring-white/20 backdrop-blur-sm">
          <Play className="size-4 fill-white text-white" />
        </div>
      </div>

      <div className="absolute bottom-4 left-4">
        <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/15 backdrop-blur-sm">
          {PLATFORM_LABELS[video.platform]}
        </span>
      </div>
    </div>
  );
}
