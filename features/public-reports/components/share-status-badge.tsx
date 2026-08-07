import type { PublicShareStatus } from "@/features/public-reports/types";
import { cn } from "@/lib/utils";

const LABELS: Record<PublicShareStatus, string> = {
  active: "Aktif",
  expired: "Süresi dolmuş",
  revoked: "İptal",
};

const STYLES: Record<PublicShareStatus, string> = {
  active: "border-emerald-700/60 bg-emerald-950/40 text-emerald-300",
  expired: "border-zinc-600 bg-zinc-900/60 text-zinc-400",
  revoked: "border-red-800/60 bg-red-950/30 text-red-300",
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
