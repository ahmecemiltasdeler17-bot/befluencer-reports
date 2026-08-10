import Link from "next/link";

import type { DashboardWarning } from "@/features/dashboard/types";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES = {
  critical: "border-red-800/50 bg-red-950/20 text-red-200",
  warning: "border-amber-800/40 bg-amber-950/20 text-amber-100",
  info: "border-[var(--bf-border-strong)] bg-[var(--bf-elevated)] text-[var(--bf-text-secondary)]",
} as const;

const SEVERITY_LABEL = {
  critical: "Kritik",
  warning: "Uyarı",
  info: "Bilgi",
} as const;

export function DashboardAttention({
  warnings,
}: {
  warnings: DashboardWarning[];
}) {
  return (
    <section
      aria-labelledby="dashboard-attention-heading"
      className="admin-panel overflow-hidden"
    >
      <div className="border-b border-[var(--bf-border)] px-4 py-3">
        <h2
          id="dashboard-attention-heading"
          className="text-sm font-medium text-[var(--bf-text)]"
        >
          Dikkat gerektirenler
        </h2>
      </div>

      {warnings.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--bf-text-muted)]">
          Şu anda dikkat gerektiren bir durum yok.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--bf-border)]">
          {warnings.map((warning) => (
            <li key={warning.id}>
              <Link
                href={warning.href}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--bf-elevated)]"
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase",
                    SEVERITY_STYLES[warning.severity]
                  )}
                >
                  {SEVERITY_LABEL[warning.severity]}
                </span>
                <span className="text-sm text-[var(--bf-text-secondary)]">
                  {warning.message}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
