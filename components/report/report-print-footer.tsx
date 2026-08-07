import { APP_NAME } from "@/lib/constants";

function formatGeneratedAt(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(date);
}

/**
 * Compact footer for the PDF layout. Values come from the stored snapshot, so a
 * re-export of the same version always prints identical metadata.
 */
export function ReportPrintFooter({
  title,
  reportNumber,
  versionNumber,
  generatedAt,
  archived,
}: {
  title: string;
  reportNumber: string;
  versionNumber: number;
  generatedAt: string | null;
  archived?: boolean;
}) {
  return (
    <footer className="pdf-avoid-break mt-16 border-t border-white/[0.08] pt-6 pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 text-[11px] text-zinc-500">
        <p className="font-semibold tracking-[0.16em] text-zinc-300 uppercase">
          {APP_NAME}
        </p>
        <p className="text-zinc-400">{title}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-zinc-500">
        <p>
          Rapor No: <span className="text-zinc-300 tabular-nums">{reportNumber}</span>
        </p>
        <p>
          Sürüm:{" "}
          <span className="text-zinc-300 tabular-nums">v{versionNumber}</span>
          {archived ? " (arşiv)" : null}
        </p>
        <p>
          Oluşturulma:{" "}
          <span className="text-zinc-300">{formatGeneratedAt(generatedAt)}</span>
        </p>
      </div>
    </footer>
  );
}
