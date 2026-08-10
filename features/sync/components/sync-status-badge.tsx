import { Badge } from "@/components/ui/badge";
import type { SyncJobStatus } from "@/features/sync/types";
import type { VideoSyncStatus } from "@/features/videos/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<SyncJobStatus | VideoSyncStatus, string> = {
  pending: "Bekliyor",
  running: "Çalışıyor",
  success: "Başarılı",
  failed: "Başarısız",
};

const STATUS_STYLES: Record<SyncJobStatus | VideoSyncStatus, string> = {
  pending: "border-bf-border bg-bf-elevated/80 text-bf-steel",
  running: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function SyncStatusBadge({
  status,
  className,
}: {
  status: SyncJobStatus | VideoSyncStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_STYLES[status], className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
