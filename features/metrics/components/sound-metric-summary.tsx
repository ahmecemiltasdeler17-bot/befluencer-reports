import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { SoundMetricSummary } from "@/features/metrics/types";
import { formatTurkishReport } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SoundMetricSummaryPanel({
  campaignId,
  summary,
}: {
  campaignId: string;
  summary: SoundMetricSummary;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-white">Ses Kullanımı</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Son güncelleme: {formatDateTime(summary.latest?.captured_at ?? null)}
          </p>
        </div>
        <Link
          href={`/campaigns/${campaignId}/sound-metrics/new`}
          className={cn(
            buttonVariants({ variant: "default" }),
            "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          Ses Kullanımı Ekle
        </Link>
      </div>

      {summary.latest ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Güncel kullanım"
            value={formatTurkishReport(summary.latest.usage_count)}
          />
          <Stat
            label="Başlangıç kullanımı"
            value={formatTurkishReport(summary.initial?.usage_count ?? 0)}
          />
          <Stat
            label="Büyüme çarpanı"
            value={
              summary.growthMultiplier !== null
                ? `${summary.growthMultiplier.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}x`
                : "—"
            }
          />
          <Stat
            label="Mutlak artış"
            value={
              summary.growthAbsolute !== null
                ? formatTurkishReport(summary.growthAbsolute)
                : "—"
            }
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          Henüz ses kullanım kaydı yok.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-medium text-white tabular-nums">{value}</p>
    </div>
  );
}
