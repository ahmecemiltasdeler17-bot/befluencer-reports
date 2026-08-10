import { REPORT_THEME } from "@/components/report/report-theme";
import { formatTurkishReport } from "@/lib/format";

/**
 * Shared Recharts presentation primitives for report charts.
 *
 * Everything here renders values Recharts resolved from the real dataset —
 * nothing is derived from cursor coordinates.
 */

interface CursorPoint {
  x: number;
  y: number;
}

export interface ReportChartCursorProps {
  points?: CursorPoint[];
  top?: number;
  height?: number;
}

/** Vertical crosshair with a faint accent column behind the active sample. */
export function ReportChartCursor({
  points,
  top = 0,
  height = 0,
}: ReportChartCursorProps) {
  const x = points?.[0]?.x;

  if (typeof x !== "number" || height <= 0) {
    return null;
  }

  return (
    <g pointerEvents="none">
      <rect
        x={x - 13}
        y={top}
        width={26}
        height={height}
        fill="url(#reportCursorColumn)"
      />
      <line
        x1={x}
        x2={x}
        y1={top}
        y2={top + height}
        stroke={REPORT_THEME.accent}
        strokeOpacity={0.45}
        strokeWidth={1}
        strokeDasharray="3 5"
      />
    </g>
  );
}

export interface ReportChartActiveDotProps {
  cx?: number;
  cy?: number;
}

/** Active measured point: solid accent core with a soft halo. */
export function ReportChartActiveDot({ cx, cy }: ReportChartActiveDotProps) {
  if (typeof cx !== "number" || typeof cy !== "number") {
    return null;
  }

  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={9} fill={REPORT_THEME.accent} opacity={0.14} />
      <circle cx={cx} cy={cy} r={5.5} fill={REPORT_THEME.accent} opacity={0.28} />
      <circle
        cx={cx}
        cy={cy}
        r={3.5}
        fill={REPORT_THEME.accentSoft}
        stroke={REPORT_THEME.bg}
        strokeWidth={2}
      />
    </g>
  );
}

/** Gradient/filter defs shared by report charts. Render once per chart. */
export function ReportChartDefs({
  gradientId,
  stopColor = REPORT_THEME.chartPrimary,
}: {
  gradientId: string;
  stopColor?: string;
}) {
  return (
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={stopColor} stopOpacity={0.26} />
        <stop offset="55%" stopColor={stopColor} stopOpacity={0.09} />
        <stop offset="100%" stopColor={stopColor} stopOpacity={0} />
      </linearGradient>
      <linearGradient id="reportCursorColumn" x1="0" y1="0" x2="0" y2="1">
        <stop
          offset="0%"
          stopColor={REPORT_THEME.accent}
          stopOpacity={0.035}
        />
        <stop
          offset="100%"
          stopColor={REPORT_THEME.accent}
          stopOpacity={0.11}
        />
      </linearGradient>
    </defs>
  );
}

/** `+1,2 B` / `-1,2 B` — compact Turkish delta with an explicit sign. */
export function formatSignedReportDelta(value: number): string {
  if (value > 0) {
    return `+${formatTurkishReport(value)}`;
  }
  return formatTurkishReport(value);
}

export interface ReportMetricTooltipProps {
  label?: string;
  metricLabel: string;
  value: number;
  /** Value at the previous REAL observation, when one exists. */
  previousValue?: number | null;
  /** Rendered after the numeric value (e.g. "kullanım"). */
  unit?: string;
  formatValue?: (value: number) => string;
}

/**
 * Floating intelligence card for chart hovers.
 * The comparison row only appears when an adjacent real observation exists.
 */
export function ReportMetricTooltip({
  label,
  metricLabel,
  value,
  previousValue,
  unit,
  formatValue = formatTurkishReport,
}: ReportMetricTooltipProps) {
  const hasComparison =
    typeof previousValue === "number" && Number.isFinite(previousValue);
  const delta = hasComparison ? value - (previousValue as number) : 0;

  return (
    <div className="report-chart-tooltip min-w-[11.5rem] rounded-xl bg-[var(--report-surface-elevated)] px-3.5 py-3 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)] ring-1 ring-[var(--report-border-strong)]">
      {label ? (
        <p className="text-[11px] font-medium tracking-[0.08em] text-[var(--report-text-secondary)]">
          {label}
        </p>
      ) : null}
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <span className="text-[11px] text-[var(--report-text-tertiary)]">
          {metricLabel}
        </span>
        <span className="text-sm font-semibold text-[var(--report-text)] tabular-nums">
          {formatValue(value)}
          {unit ? (
            <span className="ml-1 text-[11px] font-normal text-[var(--report-text-secondary)]">
              {unit}
            </span>
          ) : null}
        </span>
      </div>
      {hasComparison ? (
        <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-[var(--report-border)] pt-1.5">
          <span className="text-[11px] text-[var(--report-text-tertiary)]">
            Önceki ölçüme göre
          </span>
          <span className="text-xs font-medium text-[var(--report-accent-soft)] tabular-nums">
            {formatSignedReportDelta(delta)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
