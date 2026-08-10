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
  draft: "border-bf-border bg-bf-elevated text-bf-steel",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  completed: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  archived: "border-bf-border bg-bf-bg text-bf-steel/80",
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
