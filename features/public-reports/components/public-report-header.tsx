export function PublicReportHeader({
  campaignName,
  versionNumber,
  generatedAt,
  archived,
}: {
  campaignName: string;
  versionNumber: number;
  generatedAt: string | null;
  archived?: boolean;
}) {
  const generatedLabel = generatedAt
    ? new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(generatedAt))
    : null;

  return (
    <header className="border-b border-zinc-800/80 pb-5 print:hidden">
      <p className="text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
        BeFluencer Reports
      </p>
      <h1 className="mt-2 text-lg font-semibold text-white sm:text-xl">
        {campaignName}
      </h1>
      <p className="mt-1 text-xs text-zinc-500">
        {archived
          ? `Arşivlenmiş rapor sürümü v${versionNumber}`
          : `Rapor sürümü v${versionNumber}`}
        {generatedLabel ? ` · ${generatedLabel}` : null}
      </p>
    </header>
  );
}
