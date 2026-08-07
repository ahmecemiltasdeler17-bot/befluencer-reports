import type {
  CampaignSoundConfiguration,
  SoundMetricSummary,
} from "@/features/sound-sync/types";
import { formatExactTurkishCount } from "@/lib/format";
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

function formatSignedExact(value: number): string {
  const formatted = formatExactTurkishCount(Math.abs(value));
  if (value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("tr-TR", {
    maximumFractionDigits: 1,
  })}%`;
}

const STATUS_LABELS: Record<CampaignSoundConfiguration["syncStatus"], string> =
  {
    pending: "Beklemede",
    success: "Başarılı",
    failed: "Başarısız",
  };

const STATUS_TONES: Record<CampaignSoundConfiguration["syncStatus"], string> = {
  pending: "text-zinc-400",
  success: "text-emerald-400",
  failed: "text-red-400",
};

export function SoundMetricSummaryPanel({
  configuration,
  summary,
  qualityMessages = [],
}: {
  configuration: CampaignSoundConfiguration;
  summary: SoundMetricSummary;
  qualityMessages?: string[];
}) {
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Güncel kullanım"
          value={
            summary.currentUsage === null
              ? "—"
              : formatExactTurkishCount(summary.currentUsage)
          }
        />
        <Stat
          label="İlk kayıt"
          value={
            summary.initialUsage === null
              ? "—"
              : formatExactTurkishCount(summary.initialUsage)
          }
        />
        <Stat
          label="Mutlak büyüme"
          value={
            summary.absoluteGrowth === null
              ? "—"
              : formatSignedExact(summary.absoluteGrowth)
          }
        />
        <Stat
          label="Büyüme oranı"
          value={formatPercent(summary.growthPercentage)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Son değişim"
          value={
            summary.latestDelta === null
              ? "—"
              : formatSignedExact(summary.latestDelta)
          }
          hint={formatPercent(summary.latestDeltaPercentage)}
        />
        <Stat
          label="Son başarılı senkron"
          value={formatDateTime(configuration.lastSyncedAt)}
        />
        <Stat
          label="Senkron durumu"
          value={STATUS_LABELS[configuration.syncStatus]}
          tone={STATUS_TONES[configuration.syncStatus]}
        />
        <Stat
          label="Ses kimliği"
          value={configuration.soundId ?? "—"}
          hint={
            [configuration.soundTitle, configuration.soundAuthor]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        />
      </div>

      {configuration.syncError ? (
        <p className="text-sm text-red-400">{configuration.syncError}</p>
      ) : null}

      {qualityMessages.length > 0 ? (
        <ul className="space-y-1 text-sm text-amber-400/90">
          {qualityMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-medium text-white tabular-nums",
          tone
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
