import { Badge } from "@/components/ui/badge";
import type { VideoSyncStatus } from "@/features/videos/types";
import { cn } from "@/lib/utils";

const SYNC_LABELS: Record<VideoSyncStatus, string> = {
  pending: "Bekliyor",
  success: "Başarılı",
  failed: "Başarısız",
};

const SYNC_STYLES: Record<VideoSyncStatus, string> = {
  pending: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function VideoSyncStatusBadge({
  status,
  className,
}: {
  status: VideoSyncStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", SYNC_STYLES[status], className)}
    >
      {SYNC_LABELS[status]}
    </Badge>
  );
}
