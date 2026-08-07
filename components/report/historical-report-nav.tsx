import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DownloadReportPdfButton } from "@/features/pdf/components/download-report-pdf-button";

export function HistoricalReportNav({
  campaignId,
  versionId,
  versionNumber,
  status,
  archived,
}: {
  campaignId: string;
  versionId?: string;
  versionNumber: number;
  status?: string;
  archived?: boolean;
}) {
  return (
    <div className="absolute top-10 right-6 z-10 flex flex-col items-end gap-2 print:hidden min-[1100px]:right-12">
      <Link
        href={`/campaigns/${campaignId}`}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
        Panele Dön
      </Link>
      <Link
        href={`/campaigns/${campaignId}/reports`}
        className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        Rapor Geçmişi
      </Link>
      <Link
        href={`/campaigns/${campaignId}/report`}
        className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        Canlı Rapor
      </Link>
      {archived ? (
        <span className="text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
          Arşivlenmiş sürüm v{versionNumber}
        </span>
      ) : (
        <span className="text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
          Sürüm v{versionNumber}
        </span>
      )}
      {versionId && status ? (
        <DownloadReportPdfButton
          campaignId={campaignId}
          versionId={versionId}
          versionNumber={versionNumber}
          status={status}
        />
      ) : null}
    </div>
  );
}
