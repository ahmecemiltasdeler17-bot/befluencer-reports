export function PublicReportFooter({
  reportNumber,
  versionNumber,
}: {
  reportNumber: string | null;
  versionNumber: number;
}) {
  return (
    <footer className="mt-12 border-t border-zinc-800/80 py-8 text-center print:hidden">
      <p className="text-xs text-zinc-500">
        Bu rapor BeFluencer tarafından hazırlanmıştır.
      </p>
      <p className="mt-1 text-[11px] text-zinc-600">
        {reportNumber ? `${reportNumber} · ` : null}v{versionNumber}
      </p>
    </footer>
  );
}
