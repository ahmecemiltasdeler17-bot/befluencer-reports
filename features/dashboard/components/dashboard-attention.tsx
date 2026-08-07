import Link from "next/link";

import type { DashboardWarning } from "@/features/dashboard/types";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES = {
  critical: "border-red-800/50 bg-red-950/20 text-red-200",
  warning: "border-amber-800/40 bg-amber-950/20 text-amber-100",
  info: "border-zinc-700 bg-zinc-900/40 text-zinc-300",
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
      className="rounded-xl border border-zinc-800 bg-zinc-950/40"
    >
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2
          id="dashboard-attention-heading"
          className="text-sm font-medium text-white"
        >
          Dikkat gerektirenler
        </h2>
      </div>

      {warnings.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500">
          Şu anda dikkat gerektiren bir durum yok.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800/70">
          {warnings.map((warning) => (
            <li key={warning.id}>
              <Link
                href={warning.href}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-900/50"
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase",
                    SEVERITY_STYLES[warning.severity]
                  )}
                >
                  {SEVERITY_LABEL[warning.severity]}
                </span>
                <span className="text-sm text-zinc-300">{warning.message}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
