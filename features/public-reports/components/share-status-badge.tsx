import type { PublicShareStatus } from "@/features/public-reports/types";
import { cn } from "@/lib/utils";

const LABELS: Record<PublicShareStatus, string> = {
  active: "Aktif",
  expired: "Süresi dolmuş",
  revoked: "İptal",
};

const STYLES: Record<PublicShareStatus, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  expired: "border-bf-border bg-bf-elevated/80 text-bf-steel",
  revoked: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function ShareStatusBadge({ status }: { status: PublicShareStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] tracking-wide uppercase",
        STYLES[status]
      )}
    >
      {LABELS[status]}
    </span>
  );
}
