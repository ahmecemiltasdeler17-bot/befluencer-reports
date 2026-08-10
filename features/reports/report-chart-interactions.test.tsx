import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  formatSignedReportDelta,
  ReportMetricTooltip,
} from "@/components/report/charts/report-chart-primitives";
import { buildTrendChartData } from "@/components/report/performance-trend-section";
import { buildSoundChartData } from "@/components/report/sound-growth-section";
import type { GrowthDataPoint, SoundGrowthPoint } from "@/lib/types";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const growth: GrowthDataPoint[] = [
  { date: "1 Ağustos", views: 100, cumulativeViews: 100 },
  { date: "4 Ağustos", views: 400, cumulativeViews: 500 },
  { date: "7 Ağustos", views: 300, cumulativeViews: 800 },
];

const soundTimeline: SoundGrowthPoint[] = [
  { date: "2026-08-01", uses: 12 },
  { date: "2026-08-07", uses: 40 },
];

describe("chart data stays a 1:1 view of real observations", () => {
  it("emits exactly one trend row per stored snapshot", () => {
    const rows = buildTrendChartData(growth);

    assert.equal(rows.length, growth.length);
    assert.deepEqual(
      rows.map((row) => row.views),
      [100, 500, 800]
    );
    assert.deepEqual(
      rows.map((row) => row.label),
      ["1 Ağustos", "4 Ağustos", "7 Ağustos"]
    );
  });

  it("derives the comparison only from the adjacent real observation", () => {
    const rows = buildTrendChartData(growth);

    assert.equal(rows[0].previousViews, null);
    assert.equal(rows[1].previousViews, 100);
    assert.equal(rows[2].previousViews, 500);
  });

  it("emits exactly one sound row per stored sound snapshot", () => {
    const rows = buildSoundChartData(soundTimeline);

    assert.equal(rows.length, soundTimeline.length);
    assert.deepEqual(
      rows.map((row) => row.uses),
      [12, 40]
    );
    assert.equal(rows[0].previousUses, null);
    assert.equal(rows[1].previousUses, 12);
  });

  it("never resamples a two-point timeline into a denser series", () => {
    const rows = buildSoundChartData([
      { date: "2026-08-01", uses: 12 },
      { date: "2026-08-30", uses: 90 },
    ]);
    assert.equal(rows.length, 2);
  });
});

describe("chart tooltip presentation", () => {
  it("shows the measured value and the delta against the previous sample", () => {
    const html = renderToStaticMarkup(
      <ReportMetricTooltip
        label="7 Ağustos"
        metricLabel="Toplam izlenme"
        value={628_400}
        previousValue={576_300}
      />
    );

    assert.match(html, /7 Ağustos/);
    assert.match(html, /Toplam izlenme/);
    assert.match(html, /628,4 B/);
    assert.match(html, /Önceki ölçüme göre/);
    assert.match(html, /\+52,1 B/);
  });

  it("omits the comparison row when no previous observation exists", () => {
    const html = renderToStaticMarkup(
      <ReportMetricTooltip
        label="1 Ağustos"
        metricLabel="Toplam izlenme"
        value={100}
        previousValue={null}
      />
    );

    assert.equal(html.includes("Önceki ölçüme göre"), false);
  });

  it("formats signed deltas in Turkish", () => {
    assert.equal(formatSignedReportDelta(52_100), "+52,1 B");
    assert.equal(formatSignedReportDelta(-1_100), "-1,1 B");
  });
});

describe("chart animation and print safety", () => {
  it("keeps Recharts animation off so PDF capture is deterministic", () => {
    for (const file of [
      "components/report/performance-trend-section.tsx",
      "components/report/sound-growth-section.tsx",
    ]) {
      assert.match(read(file), /isAnimationActive=\{false\}/);
    }
  });

  it("runs the reveal once and disables it for reduced motion and PDF", () => {
    const css = read("app/globals.css");

    assert.match(css, /\.report-chart-reveal/);
    assert.match(css, /animation: report-chart-reveal[^;]*backwards/);
    assert.match(
      css,
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.report-chart-reveal\s*\{\s*animation: none !important/
    );
    assert.match(css, /\.pdf-document \*[\s\S]*?animation: none !important/);
  });

  it("documents the sound waveform as decorative, not measured", () => {
    const source = read("components/report/sound-growth-section.tsx");
    assert.match(source, /data-decorative="true"/);
    assert.match(source, /aria-hidden/);
    assert.match(source, /carry no measurement meaning/);
  });
});
