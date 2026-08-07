import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DownloadReportPdfButton } from "@/features/pdf/components/download-report-pdf-button";
import { CreateShareDialog } from "@/features/public-reports/components/create-share-dialog";
import { ArchiveReportVersionButton } from "@/features/report-generation/components/archive-report-version-button";
import { ReportVersionStatusBadge } from "@/features/report-generation/components/report-version-status-badge";
import type { ReportVersionSummary } from "@/features/report-generation/types";
import { formatTurkishDate, formatTurkishPercent, formatTurkishReport } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ReportVersionRow({
  campaignId,
  version,
  compareBaseId,
}: {
  campaignId: string;
  version: ReportVersionSummary;
  compareBaseId?: string | null;
}) {
  const canOpen = version.status === "ready" || version.status === "archived";
  const canCompare = canOpen && compareBaseId && compareBaseId !== version.id;
  const canArchive = version.status === "ready";

  return (
    <tr className="text-zinc-200">
      <td className="px-3 py-3 font-medium">v{version.versionNumber}</td>
      <td className="px-3 py-3">
        <ReportVersionStatusBadge status={version.status} />
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        {formatDateTime(version.generatedAt)}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-zinc-400">
        {version.generatedBy ? version.generatedBy.slice(0, 8) : "—"}
      </td>
      <td className="px-3 py-3 tabular-nums">
        {version.totalViews !== null
          ? formatTurkishReport(version.totalViews)
          : "—"}
      </td>
      <td className="px-3 py-3 tabular-nums">
        {version.engagementRate !== null
          ? formatTurkishPercent(version.engagementRate)
          : "—"}
      </td>
      <td className="px-3 py-3 tabular-nums">{version.sourceVideoCount}</td>
      <td className="px-3 py-3 tabular-nums">{version.sourceCreatorCount}</td>
      <td className="px-3 py-3 whitespace-nowrap text-zinc-400">
        {version.sourceLastSyncedAt
          ? formatTurkishDate(version.sourceLastSyncedAt)
          : "—"}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canOpen ? (
            <Link
              href={`/campaigns/${campaignId}/reports/${version.id}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Aç
            </Link>
          ) : null}
          {canCompare ? (
            <Link
              href={`/campaigns/${campaignId}/reports/compare?from=${compareBaseId}&to=${version.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Karşılaştır
            </Link>
          ) : null}
          {canOpen ? (
            <DownloadReportPdfButton
              campaignId={campaignId}
              versionId={version.id}
              versionNumber={version.versionNumber}
              status={version.status}
            />
          ) : null}
          {canOpen ? (
            <CreateShareDialog reportVersionId={version.id} />
          ) : null}
          {canOpen ? (
            <Link
              href={`/campaigns/${campaignId}/reports/${version.id}#shares`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Paylaşım Linkleri
            </Link>
          ) : null}
          {canArchive ? (
            <ArchiveReportVersionButton versionId={version.id} />
          ) : null}
        </div>
        {version.status === "failed" && version.errorMessage ? (
          <p className="mt-2 text-right text-xs text-red-400">
            {version.errorMessage}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
