import { formatTurkishDate } from "@/lib/format";
import type { CampaignReportSeriesSummary } from "@/features/report-generation/types";
import { ReportVersionStatusBadge } from "@/features/report-generation/components/report-version-status-badge";

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

export function ReportVersionMetadata({
  summary,
}: {
  summary: CampaignReportSeriesSummary;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <MetadataItem
        label="Rapor numarası"
        value={summary.reportNumber ?? "—"}
      />
      <MetadataItem
        label="Sürüm sayısı"
        value={String(summary.versionCount)}
      />
      <MetadataItem
        label="Son sürüm durumu"
        value={
          summary.latestVersion ? (
            <ReportVersionStatusBadge status={summary.latestVersion.status} />
          ) : (
            "—"
          )
        }
      />
      <MetadataItem
        label="Son oluşturulma"
        value={formatDateTime(summary.latestVersion?.generatedAt ?? null)}
      />
      <MetadataItem
        label="Kaynak video sayısı"
        value={String(summary.latestVersion?.sourceVideoCount ?? "—")}
      />
      <MetadataItem
        label="Kaynak üretici sayısı"
        value={String(summary.latestVersion?.sourceCreatorCount ?? "—")}
      />
      <MetadataItem
        label="Son veri güncelleme"
        value={
          summary.liveFreshness.lastSuccessfulSyncAt
            ? formatTurkishDate(summary.liveFreshness.lastSuccessfulSyncAt)
            : "—"
        }
      />
      <MetadataItem
        label="Metriksiz içerik"
        value={String(summary.liveFreshness.videosWithoutMetrics)}
      />
      <MetadataItem
        label="Güncelliğini yitirmiş içerik"
        value={String(summary.liveFreshness.staleVideoCount)}
      />
    </dl>
  );
}

function MetadataItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-200">{value}</dd>
    </div>
  );
}
