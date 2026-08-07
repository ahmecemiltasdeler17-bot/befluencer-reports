import { Badge } from "@/components/ui/badge";
import type { CreatorPlatform } from "@/features/creators/types";
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<CreatorPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

export function getPlatformLabel(platform: CreatorPlatform): string {
  return PLATFORM_LABELS[platform];
}

export function CreatorPlatformBadge({
  platform,
  className,
}: {
  platform: CreatorPlatform;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-zinc-700 bg-zinc-900/60 text-zinc-300",
        className
      )}
    >
      {PLATFORM_LABELS[platform]}
    </Badge>
  );
}
