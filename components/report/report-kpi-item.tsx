interface ReportKpiItemProps {
  label: string;
  value: string;
  hint?: string;
}

export function ReportKpiItem({ label, value, hint }: ReportKpiItemProps) {
  return (
    <div className="flex flex-col items-center border-r border-white/[0.06] px-4 py-6 text-center nth-[2n]:border-r-0 min-[1100px]:nth-[2n]:border-r min-[1100px]:nth-[4n]:border-r-0 sm:px-6 min-[1100px]:py-8">
      <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-500 uppercase">
        {label}
      </p>
      <p className="mt-3 text-[28px] leading-none font-bold tracking-tight text-white tabular-nums min-[1100px]:text-[32px]">
        {value}
      </p>
      {hint && (
        <p className="mt-2 max-w-[160px] text-xs leading-relaxed text-zinc-500">
          {hint}
        </p>
      )}
    </div>
  );
}
