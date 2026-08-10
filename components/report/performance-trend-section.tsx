"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Dot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ReportChartActiveDot,
  ReportChartCursor,
  ReportChartDefs,
  ReportMetricTooltip,
} from "@/components/report/charts/report-chart-primitives";
import { ReportMeasurementNote } from "@/components/report/charts/report-measurement-note";
import { REPORT_THEME } from "@/components/report/report-theme";
import { formatTurkishDayMonth, formatTurkishReport } from "@/lib/format";
import type { GrowthDataPoint, TrendDataPoint } from "@/lib/types";

interface PerformanceTrendSectionProps {
  growth: GrowthDataPoint[];
  trend: TrendDataPoint[];
  hasTimeline?: boolean;
  /** When true, parent section already provides the title. */
  hideHeading?: boolean;
}

interface TrendSummary {
  last7Days: number;
  dailyAverage: number;
  peakDate: string;
}

/** Chart row: cumulative value plus the previous REAL observation. */
export interface TrendChartPoint {
  label: string;
  views: number;
  previousViews: number | null;
}

/**
 * Maps real snapshots to chart rows. One row per stored observation — no
 * interpolated, resampled or synthesized entries are added.
 */
export function buildTrendChartData(
  growth: GrowthDataPoint[]
): TrendChartPoint[] {
  return growth.map((point, index) => ({
    label: point.date,
    views: point.cumulativeViews,
    previousViews: index > 0 ? growth[index - 1].cumulativeViews : null,
  }));
}

function computeTrendSummary(
  growth: GrowthDataPoint[],
  trend: TrendDataPoint[]
): TrendSummary {
  const deltas = trend.slice(1).map((point, index) => ({
    date: point.date,
    value: point.views - trend[index].views,
  }));

  const last7 = deltas.slice(-7);
  const last7Days = last7.reduce((sum, item) => sum + item.value, 0);
  const dailyAverage =
    deltas.length > 0
      ? deltas.reduce((sum, item) => sum + item.value, 0) / deltas.length
      : 0;

  const peak = deltas.reduce(
    (best, item) => (item.value > best.value ? item : best),
    deltas[0] ?? { date: trend[0]?.date ?? "", value: 0 }
  );

  if (last7Days === 0 && growth.length >= 2) {
    const recent = growth[growth.length - 1].cumulativeViews;
    const previous = growth[Math.max(0, growth.length - 3)].cumulativeViews;
    return {
      last7Days: recent - previous,
      dailyAverage: recent / growth.length,
      peakDate: trend[trend.length - 1]?.date ?? peak.date,
    };
  }

  return {
    last7Days,
    dailyAverage,
    peakDate: peak.date,
  };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: TrendChartPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <ReportMetricTooltip
      label={label}
      metricLabel="Toplam izlenme"
      value={point.views}
      previousValue={point.previousViews}
    />
  );
}

export function PerformanceTrendSection({
  growth,
  trend,
  hasTimeline = true,
  hideHeading = false,
}: PerformanceTrendSectionProps) {
  if (!hasTimeline || growth.length < 2) {
    return (
      <div className="report-chart-panel report-empty-panel pdf-avoid-break px-6 py-12 text-center">
        <p className="text-sm text-[var(--report-text-tertiary)]">
          Trend grafiği için en az iki metrik kaydı gerekli.
        </p>
      </div>
    );
  }

  const summary = computeTrendSummary(growth, trend);
  const chartData = buildTrendChartData(growth);
  const sparse = chartData.length <= 6;

  return (
    <div
      className="w-full"
      aria-label={hideHeading ? undefined : "Performans trendi"}
    >
      {!hideHeading ? (
        <div className="mb-8 max-w-xl">
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--report-text)] min-[1100px]:text-[28px]">
            Performans Trendi
          </h2>
          <p className="mt-2 text-sm text-[var(--report-text-secondary)]">
            Kampanya başlangıcından itibaren toplam izlenme
          </p>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <ReportMeasurementNote count={chartData.length} />

        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <SummaryItem
            label="Son 7 gün"
            value={`+${formatTurkishReport(summary.last7Days)}`}
          />
          <SummaryItem
            label="Günlük ortalama"
            value={formatTurkishReport(summary.dailyAverage)}
          />
          <SummaryItem
            label="En yüksek gün"
            value={formatTurkishDayMonth(summary.peakDate)}
          />
        </div>
      </div>

      <div className="report-chart-panel pdf-avoid-break px-2 py-5 min-[800px]:px-4 min-[800px]:py-6">
        <div className="report-chart-panel__plot report-chart-reveal h-[262px] w-full min-[1100px]:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 16, right: 12, left: 2, bottom: 6 }}
            >
              <ReportChartDefs gradientId="reachGradient" />
              <CartesianGrid
                stroke={REPORT_THEME.grid}
                strokeDasharray="4 8"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fill: REPORT_THEME.textFaint,
                  fontSize: 11,
                  fontFamily: "inherit",
                }}
                axisLine={false}
                tickLine={false}
                dy={8}
                minTickGap={32}
              />
              <YAxis
                tickFormatter={(value) => formatTurkishReport(value)}
                tick={{
                  fill: REPORT_THEME.textFaint,
                  fontSize: 11,
                  fontFamily: "inherit",
                }}
                axisLine={false}
                tickLine={false}
                width={54}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={<ReportChartCursor />}
                offset={16}
                allowEscapeViewBox={{ x: false, y: false }}
              />
              <Area
                type="monotone"
                dataKey="views"
                name="İzlenme"
                stroke={REPORT_THEME.chartPrimary}
                strokeWidth={2}
                fill="url(#reachGradient)"
                isAnimationActive={false}
                dot={
                  sparse ? (
                    <Dot
                      r={3}
                      fill={REPORT_THEME.bg}
                      stroke={REPORT_THEME.chartPrimary}
                      strokeWidth={2}
                    />
                  ) : (
                    false
                  )
                }
                activeDot={<ReportChartActiveDot />}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.14em] text-[var(--report-text-tertiary)] uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--report-text)] tabular-nums">
        {value}
      </p>
    </div>
  );
}
