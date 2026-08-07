import { cn } from "@/lib/utils";

export function MetricDelta({
  value,
  percentage,
  className,
}: {
  value: number;
  percentage?: number | null;
  className?: string;
}) {
  const tone =
    value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

  const toneClass = {
    positive: "text-emerald-400",
    negative: "text-red-400",
    neutral: "text-zinc-500",
  }[tone];

  const prefix = value > 0 ? "+" : "";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", toneClass, className)}>
      <span aria-hidden="true">
        {tone === "positive" ? "▲" : tone === "negative" ? "▼" : "•"}
      </span>
      <span className="tabular-nums">
        {prefix}
        {value.toLocaleString("tr-TR")}
      </span>
      {percentage !== undefined && percentage !== null ? (
        <span className="text-zinc-500">
          ({prefix}
          {percentage.toLocaleString("tr-TR", {
            maximumFractionDigits: 1,
          })}
          %)
        </span>
      ) : null}
    </span>
  );
}
