import { Badge } from "@/components/ui/badge";
import {
  VIDEO_STATUS_FROM_DB,
  type VideoDbStatus,
  type VideoStatus,
} from "@/features/videos/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<VideoStatus, string> = {
  draft: "Taslak",
  published: "Yayında",
  removed: "Kaldırıldı",
};

const STATUS_STYLES: Record<VideoStatus, string> = {
  draft: "border-zinc-700 bg-zinc-800/80 text-zinc-300",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  removed: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function getVideoStatusLabel(status: VideoStatus | VideoDbStatus): string {
  const uiStatus =
    status in STATUS_LABELS
      ? (status as VideoStatus)
      : VIDEO_STATUS_FROM_DB[status as VideoDbStatus];

  return STATUS_LABELS[uiStatus];
}

export function VideoStatusBadge({
  status,
  className,
}: {
  status: VideoStatus | VideoDbStatus;
  className?: string;
}) {
  const uiStatus =
    status in STATUS_LABELS
      ? (status as VideoStatus)
      : VIDEO_STATUS_FROM_DB[status as VideoDbStatus];

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_STYLES[uiStatus], className)}
    >
      {STATUS_LABELS[uiStatus]}
    </Badge>
  );
}
