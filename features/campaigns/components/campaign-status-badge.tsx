import { Badge } from "@/components/ui/badge";
import type { CampaignStatus } from "@/features/campaigns/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Taslak",
  active: "Aktif",
  completed: "Tamamlandı",
  archived: "Arşivlendi",
};

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "border-zinc-700 bg-zinc-800/80 text-zinc-300",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  completed: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  archived: "border-zinc-600 bg-zinc-900 text-zinc-400",
};

export function getCampaignStatusLabel(status: CampaignStatus): string {
  return STATUS_LABELS[status];
}

export function CampaignStatusBadge({
  status,
  className,
}: {
  status: CampaignStatus;
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
