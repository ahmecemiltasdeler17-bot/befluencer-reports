import { APP_NAME } from "@/lib/constants";
import { formatTurkishDate } from "@/lib/format";
import type { Campaign } from "@/lib/types";

interface ReportHeaderProps {
  campaign: Campaign;
  reportNumber?: string;
  reportDate?: string;
}

export function ReportHeader({
  campaign,
  reportNumber = "RPT-2026-0047",
  reportDate,
}: ReportHeaderProps) {
  const date = reportDate ?? formatTurkishDate(campaign.endDate);

  return (
    <header className="grid grid-cols-1 items-start gap-6 min-[1100px]:grid-cols-[1fr_auto_1fr] min-[1100px]:items-center min-[1100px]:gap-8">
      <div className="min-[1100px]:justify-self-start">
        <p className="text-[11px] font-medium tracking-[0.18em] text-zinc-500 uppercase">
          {APP_NAME}
        </p>
      </div>

      <div className="text-center min-[1100px]:justify-self-center">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-white min-[1100px]:text-[32px]">
          {campaign.name}
        </h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          {campaign.artist} · {campaign.track}
        </p>
      </div>

      <div className="flex flex-col gap-2 text-left min-[1100px]:justify-self-end min-[1100px]:text-right">
        <div>
          <p className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase">
            Rapor No
          </p>
          <p className="mt-0.5 text-sm font-medium text-white tabular-nums">
            {reportNumber}
          </p>
        </div>
        <div>
          <p className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase">
            Rapor Tarihi
          </p>
          <p className="mt-0.5 text-sm font-medium text-white">{date}</p>
        </div>
      </div>
    </header>
  );
}
