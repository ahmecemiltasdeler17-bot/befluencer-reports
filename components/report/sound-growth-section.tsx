"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Dot,
  Label,
  ReferenceDot,
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
import { formatTurkishChartDate } from "@/lib/format";
import { generateWaveformBars } from "@/lib/media-fallback-styles";
import type { SoundGrowth, SoundGrowthPoint } from "@/lib/types";

function isHttpCoverUrl(value: string | null | undefined): value is string {
  if (!value || value.trim().length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

interface SoundGrowthSectionProps {
  data: SoundGrowth;
  hasTimeline?: boolean;
}

/** Chart row: a real sound snapshot plus its previous real snapshot. */
export interface SoundChartPoint {
  label: string;
  uses: number;
  previousUses: number | null;
}

/**
 * One row per stored sound snapshot. No intermediate samples are generated,
 * so a sparse timeline stays visibly sparse.
 */
export function buildSoundChartData(
  timeline: SoundGrowthPoint[]
): SoundChartPoint[] {
  return timeline.map((point, index) => ({
    label: formatTurkishChartDate(point.date),
    uses: point.uses,
    previousUses: index > 0 ? timeline[index - 1].uses : null,
  }));
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: SoundChartPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <ReportMetricTooltip
      label={label}
      metricLabel="Ses kullanımı"
      value={point.uses}
      previousValue={point.previousUses}
      unit="kullanım"
      formatValue={(value) => value.toLocaleString("tr-TR")}
    />
  );
}

/**
 * Decorative equalizer texture for the sound identity card.
 * Bars are deterministic from the sound name and carry no measurement meaning,
 * so they are hidden from assistive tech and never produce tooltip values.
 */
function SoundWaveform({ seed }: { seed: string }) {
  const bars = generateWaveformBars(seed, 56);

  return (
    <div
      className="report-waveform flex h-12 items-end gap-[2px]"
      aria-hidden
      data-decorative="true"
    >
      {bars.map((height, index) => (
        <span
          key={index}
          className="report-waveform__bar w-[3px] rounded-full bg-[var(--report-accent)]/50"
          style={{
            height: `${Math.round(height * 100)}%`,
            transitionDelay: `${index * 6}ms`,
          }}
        />
      ))}
    </div>
  );
}

function SoundCoverArtwork({
  coverUrl,
  alt,
}: {
  coverUrl: string;
  alt: string;
}) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <div
      className="relative size-[68px] shrink-0 overflow-hidden rounded-lg border border-[var(--report-border)] bg-[var(--report-surface-elevated)]"
      aria-hidden={alt ? undefined : true}
    >
      <Image
        src={coverUrl}
        alt={alt}
        width={68}
        height={68}
        unoptimized
        className="size-full object-cover"
        onError={() => setHidden(true)}
      />
    </div>
  );
}

export function SoundGrowthSection({
  data,
  hasTimeline = true,
}: SoundGrowthSectionProps) {
  if (!hasTimeline || data.timeline.length < 2) {
    return null;
  }

  const chartData = buildSoundChartData(data.timeline);
  const peakPoint = chartData.reduce((best, point) =>
    point.uses > best.uses ? point : best
  );
  const startPoint = chartData[0];
  const currentPoint = chartData[chartData.length - 1];
  const sparse = chartData.length <= 6;

  return (
    <section
      aria-label="Ses kullanım büyümesi"
      className="pdf-section report-section mt-14 min-[1100px]:mt-16"
    >
      <div className="flex flex-col gap-8 min-[800px]:flex-row min-[800px]:items-end min-[800px]:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium tracking-[0.16em] text-[var(--report-text-tertiary)] uppercase">
            Ses
          </p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--report-text)] min-[1100px]:text-[28px]">
            Ses Performansı
          </h2>
          <p className="mt-2 text-sm text-[var(--report-text-secondary)] min-[1100px]:text-base">
            TikTok üzerinde ses kullanımının kampanya boyunca gelişimi.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 min-[800px]:gap-8">
          <MetricBlock
            label="Büyüme"
            value={`×${data.multiplier.toFixed(1).replace(".", ",")}`}
            valueClassName="text-[var(--report-text)]"
          />
          <MetricBlock
            label="Güncel Kullanım"
            value={String(data.currentUses)}
            valueClassName="text-[var(--report-text)]"
          />
          <MetricBlock
            label="Başlangıç Kullanımı"
            value={String(data.initialUses)}
            valueClassName="text-[var(--report-text-tertiary)]"
          />
        </div>
      </div>

      <div className="report-interactive mt-8 flex flex-col gap-3 rounded-xl bg-[var(--report-surface)] px-4 py-4 shadow-[inset_0_0_0_1px_var(--report-border)] transition-[box-shadow,transform,background-color] duration-200 hover:-translate-y-px hover:bg-[var(--report-surface-hover)] hover:shadow-[inset_0_0_0_1px_var(--report-ring-accent),var(--report-elevation)] min-[800px]:flex-row min-[800px]:items-center min-[800px]:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          {isHttpCoverUrl(data.soundCoverUrl) ? (
            <SoundCoverArtwork
              coverUrl={data.soundCoverUrl}
              alt={`${data.soundName} kapak görseli`}
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--report-text)]">
              {data.soundName}
            </p>
            <p className="mt-1 text-xs tracking-wide text-[var(--report-text-tertiary)]">
              {data.soundAuthor
                ? `${data.soundAuthor} · TikTok ses`
                : "TikTok ses"}
            </p>
          </div>
        </div>
        <div className="max-w-md flex-1">
          <SoundWaveform seed={data.soundName} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <ReportMeasurementNote
          count={chartData.length}
          hint="Ses kullanımı yalnızca gerçek anlık ölçümlerden gösterilir; ölçümler arası değer üretilmez."
        />
      </div>

      <div className="report-chart-panel pdf-avoid-break mt-4 px-2 py-5 min-[800px]:px-4 min-[800px]:py-6">
        <div className="report-chart-panel__plot report-chart-reveal h-[262px] w-full min-[1100px]:h-[292px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 30, right: 14, left: 2, bottom: 6 }}
            >
              <ReportChartDefs gradientId="soundGrowthGradient" />
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
                minTickGap={28}
              />
              <YAxis
                tick={{
                  fill: REPORT_THEME.textFaint,
                  fontSize: 11,
                  fontFamily: "inherit",
                }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={<ReportChartCursor />}
                offset={16}
              />
              <Area
                type="monotone"
                dataKey="uses"
                stroke={REPORT_THEME.chartPrimary}
                strokeWidth={2}
                fill="url(#soundGrowthGradient)"
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
              <ReferenceDot
                x={startPoint.label}
                y={startPoint.uses}
                r={3.5}
                fill={REPORT_THEME.chartPrimary}
                stroke={REPORT_THEME.bg}
                strokeWidth={2}
              >
                <Label
                  value="Başlangıç"
                  position="top"
                  fill={REPORT_THEME.textMuted}
                  fontSize={11}
                  offset={8}
                />
              </ReferenceDot>
              {peakPoint.label !== startPoint.label &&
              peakPoint.label !== currentPoint.label ? (
                <ReferenceDot
                  x={peakPoint.label}
                  y={peakPoint.uses}
                  r={3.5}
                  fill={REPORT_THEME.accentStrong}
                  stroke={REPORT_THEME.bg}
                  strokeWidth={2}
                >
                  <Label
                    value="Zirve"
                    position="top"
                    fill={REPORT_THEME.textMuted}
                    fontSize={11}
                    offset={8}
                  />
                </ReferenceDot>
              ) : null}
              <ReferenceDot
                x={currentPoint.label}
                y={currentPoint.uses}
                r={3.5}
                fill={REPORT_THEME.accentSoft}
                stroke={REPORT_THEME.bg}
                strokeWidth={2}
              >
                <Label
                  value="Güncel"
                  position="top"
                  fill={REPORT_THEME.textMuted}
                  fontSize={11}
                  offset={8}
                />
              </ReferenceDot>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function MetricBlock({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-[0.14em] text-[var(--report-text-tertiary)] uppercase">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${valueClassName ?? "text-[var(--report-text)]"}`}
      >
        {value}
      </p>
    </div>
  );
}
