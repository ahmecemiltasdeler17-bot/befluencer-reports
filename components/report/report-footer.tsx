interface ReportFooterProps {
  reportNumber?: string;
  reportDate?: string;
  lastUpdated?: string;
  presentationNote?: string;
}

export function ReportFooter({
  reportNumber,
  reportDate,
  lastUpdated,
  presentationNote = "Bu rapor BeFluencer raporlama altyapısı ile hazırlanmıştır.",
}: ReportFooterProps) {
  return (
    <footer className="pdf-avoid-break mt-20 border-t border-white/[0.06] pt-10 pb-16 text-center min-[1100px]:mt-24">
      <p className="text-sm font-semibold tracking-[0.18em] text-zinc-300 uppercase">
        BeFluencer
      </p>
      <p className="mt-2 text-sm text-zinc-400">TikTok Müzik Kampanya Raporu</p>

      <div className="mx-auto mt-8 flex max-w-lg flex-col gap-2 text-sm text-zinc-500">
        {reportNumber ? (
          <p>
            Rapor No:{" "}
            <span className="text-zinc-300 tabular-nums">{reportNumber}</span>
          </p>
        ) : null}
        {reportDate ? (
          <p>
            Rapor Tarihi: <span className="text-zinc-300">{reportDate}</span>
          </p>
        ) : null}
        {lastUpdated ? (
          <p>
            Son Güncelleme:{" "}
            <span className="text-zinc-300">{lastUpdated}</span>
          </p>
        ) : null}
      </div>

      <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-zinc-600">
        {presentationNote}
      </p>
    </footer>
  );
}
