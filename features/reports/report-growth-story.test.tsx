import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  deriveAbsoluteGrowth,
  ReportGrowthStory,
} from "@/components/report/report-growth-story";
import type { TotalReach } from "@/lib/types";

const positive: TotalReach = {
  label: "Total Reach",
  value: 676_900,
  previousValue: 596_900,
  growthSinceStart: 13.4,
};

describe("report growth storytelling", () => {
  it("derives absolute gain only from stored totalReach fields", () => {
    assert.equal(deriveAbsoluteGrowth(positive), 80_000);
    assert.equal(
      deriveAbsoluteGrowth({ ...positive, growthSinceStart: null }),
      null
    );
  });

  it("renders the exact growth percentage without exaggeration", () => {
    const html = renderToStaticMarkup(
      <ReportGrowthStory totalReach={positive} />
    );

    assert.match(html, /\+13,4%/);
    assert.match(html, /Kampanya büyümesi/);
    assert.match(html, /\+80,0 B/);
    assert.match(html, /Net izlenme/);
    assert.match(html, /596,9 B/);
    assert.match(html, /676,9 B/);
    assert.match(html, /data-growth-tone="positive"/);
    assert.equal(html.includes("sektör"), false);
    assert.equal(html.includes("rekor"), false);
    assert.equal(html.includes("hedef"), false);
  });

  it("stays neutral when no comparison exists", () => {
    const html = renderToStaticMarkup(
      <ReportGrowthStory
        totalReach={{
          label: "Toplam İzlenme",
          value: 100,
          previousValue: 0,
          growthSinceStart: null,
        }}
      />
    );

    assert.match(html, /Henüz karşılaştırma yok/);
    assert.equal(html.includes("+"), false);
  });

  it("renders negative growth truthfully", () => {
    const html = renderToStaticMarkup(
      <ReportGrowthStory
        totalReach={{
          label: "Toplam İzlenme",
          value: 90,
          previousValue: 100,
          growthSinceStart: -10,
        }}
      />
    );

    assert.match(html, /-10,0%/);
    assert.match(html, /data-growth-tone="negative"/);
  });
});
