import { BeFluencerMark } from "@/components/report/brand/befluencer-mark";

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
    <header className="border-b border-white/[0.06] pb-5 print:hidden">
      <BeFluencerMark />
      <h1 className="mt-3 text-lg font-semibold tracking-tight text-white sm:text-xl">
        {campaignName}
      </h1>
      <p className="mt-1.5 text-xs text-zinc-500">
        {archived
          ? `Arşivlenmiş rapor sürümü v${versionNumber}`
          : `Rapor sürümü v${versionNumber}`}
        {generatedLabel ? ` · ${generatedLabel}` : null}
      </p>
    </header>
  );
}
