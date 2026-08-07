import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DownloadReportPdfButton } from "@/features/pdf/components/download-report-pdf-button";
import { CreateShareDialog } from "@/features/public-reports/components/create-share-dialog";
import { ReportVersionStatusBadge } from "@/features/report-generation/components/report-version-status-badge";
import type { DashboardRecentReport } from "@/features/dashboard/types";
import type { ReportVersionStatus } from "@/features/report-generation/types";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DashboardRecentReports({
  reports,
}: {
  reports: DashboardRecentReport[];
}) {
  return (
    <section
      aria-labelledby="dashboard-reports-heading"
      className="rounded-xl border border-zinc-800 bg-zinc-950/40"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2
          id="dashboard-reports-heading"
          className="text-sm font-medium text-white"
        >
          Son raporlar
        </h2>
        <Link
          href="/reports"
          className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Raporlar
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500">
          Henüz oluşturulmuş rapor sürümü yok.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800/70">
          {reports.map((report) => (
            <li
              key={report.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {report.campaignName}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {report.reportNumber ? `${report.reportNumber} · ` : null}v
                  {report.versionNumber} · {formatDateTime(report.generatedAt)}
                </p>
                <div className="mt-1.5">
                  <ReportVersionStatusBadge
                    status={report.status as ReportVersionStatus}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Link
                  href={`/campaigns/${report.campaignId}/reports/${report.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" })
                  )}
                >
                  Görüntüle
                </Link>
                <DownloadReportPdfButton
                  campaignId={report.campaignId}
                  versionId={report.id}
                  versionNumber={report.versionNumber}
                  status={report.status}
                />
                <CreateShareDialog reportVersionId={report.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
