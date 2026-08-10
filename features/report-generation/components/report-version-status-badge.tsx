import { Badge } from "@/components/ui/badge";
import type { ReportVersionStatus } from "@/features/report-generation/types";
import { cn } from "@/lib/utils";

const LABELS: Record<ReportVersionStatus, string> = {
  generating: "Hazırlanıyor",
  ready: "Hazır",
  failed: "Başarısız",
  archived: "Arşiv",
};

const STYLES: Record<ReportVersionStatus, string> = {
  generating: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
  archived: "border-bf-border bg-bf-elevated/80 text-bf-steel",
};

export function ReportVersionStatusBadge({
  status,
  className,
}: {
  status: ReportVersionStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STYLES[status], className)}
    >
      {LABELS[status]}
    </Badge>
  );
}
