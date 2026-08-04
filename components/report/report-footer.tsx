import { APP_NAME } from "@/lib/constants";

interface ReportFooterProps {
  reportNumber?: string;
  reportDate?: string;
  lastUpdated?: string;
}

export function ReportFooter({
  reportNumber = "RPT-2026-0047",
  reportDate = "1 Mart 2026",
  lastUpdated = "4 Ağustos 2026, 04:00",
}: ReportFooterProps) {
  return (
    <footer className="mt-32 border-t border-white/[0.06] pt-16 pb-20 text-center">
      <p className="text-sm font-semibold tracking-[0.18em] text-zinc-300 uppercase">
        {APP_NAME}
      </p>
      <p className="mt-2 text-base text-zinc-400">TikTok Müzik Kampanya Raporu</p>

      <div className="mx-auto mt-10 flex max-w-md flex-col gap-2 text-sm text-zinc-500">
        <p>
          Rapor No:{" "}
          <span className="text-zinc-300 tabular-nums">{reportNumber}</span>
        </p>
        <p>
          Rapor Tarihi:{" "}
          <span className="text-zinc-300">{reportDate}</span>
        </p>
        <p>
          Son Güncelleme:{" "}
          <span className="text-zinc-300">{lastUpdated}</span>
        </p>
      </div>
    </footer>
  );
}
