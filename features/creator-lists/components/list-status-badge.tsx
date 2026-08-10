import { Badge } from "@/components/ui/badge";
import type { CreatorListStatus } from "@/features/creator-lists/types";
import { cn } from "@/lib/utils";

const LABELS: Record<CreatorListStatus, string> = {
  draft: "Taslak",
  ready: "Hazır",
  archived: "Arşiv",
};

const STYLES: Record<CreatorListStatus, string> = {
  draft: "border-bf-border bg-bf-elevated text-bf-steel",
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  archived: "border-bf-border bg-bf-bg text-bf-steel/80",
};

export function ListStatusBadge({ status }: { status: CreatorListStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[status])}>
      {LABELS[status]}
    </Badge>
  );
}
