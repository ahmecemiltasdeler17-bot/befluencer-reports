import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { CreatorContributionList } from "@/components/report/creator-contribution-list";
import { EngagementDistribution } from "@/components/report/engagement-distribution";
import type { Creator, KpiMetric, Video } from "@/lib/types";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const kpis: KpiMetric[] = [
  {
    id: "engagement-rate",
    label: "Etkileşim oranı",
    value: 7.2,
    previousValue: 6.9,
    format: "percent",
  },
];

const videos: Video[] = [
  {
    id: "v1",
    title: "Video",
    creatorHandle: "@a",
    creatorName: "A",
    creatorAvatar: "",
    thumbnail: "",
    platform: "tiktok",
    views: 1000,
    likes: 800,
    comments: 120,
    shares: 60,
    saves: 20,
    engagementRate: 7.2,
    publishedAt: "2026-06-01",
    url: "https://www.tiktok.com/@a/video/7123456789012345678",
    category: "micro",
    hasMetrics: true,
  },
];

const creators: Creator[] = [
  {
    id: "c1",
    rank: 1,
    handle: "@a",
    displayName: "A",
    avatar: "",
    followers: 1000,
    videos: 1,
    views: 800,
    engagement: 100,
    engagementRate: 7.2,
    category: "micro",
    platform: "tiktok",
    profileUrl: "https://www.tiktok.com/@a",
  },
];

describe("engagement distribution interaction", () => {
  it("renders one legend control per real component with its measured value", () => {
    const html = renderToStaticMarkup(
      <EngagementDistribution videos={videos} kpis={kpis} />
    );

    for (const label of ["Beğeni", "Yorum", "Paylaşım", "Kaydetme"]) {
      assert.match(html, new RegExp(label));
    }
    assert.equal((html.match(/report-legend-row/g) ?? []).length, 4);
    assert.match(html, /aria-label="Beğeni: 800"/);
    // Sum of the four real components, not a recomputed rate.
    assert.match(html, /1,0 B/);
  });

  it("starts with no active segment so SSR output is deterministic", () => {
    const html = renderToStaticMarkup(
      <EngagementDistribution videos={videos} kpis={kpis} />
    );

    assert.match(html, /Toplam/);
    assert.equal((html.match(/data-active="true"/g) ?? []).length, 0);
    assert.equal((html.match(/data-dimmed="true"/g) ?? []).length, 0);
  });

  it("keeps legend rows in the PDF even though they are buttons", () => {
    const html = renderToStaticMarkup(
      <EngagementDistribution videos={videos} kpis={kpis} />
    );
    const css = read("app/globals.css");

    assert.equal((html.match(/data-print-keep="true"/g) ?? []).length, 4);
    assert.match(css, /\.pdf-document button:not\(\[data-print-keep="true"\]\)/);
  });
});

describe("creator contribution rows", () => {
  it("responds to hover and focus without a client boundary", () => {
    const source = read("components/report/creator-contribution-list.tsx");
    const html = renderToStaticMarkup(
      <CreatorContributionList creators={creators} totalReach={1000} />
    );
    const css = read("app/globals.css");

    assert.equal(source.includes('"use client"'), false);
    assert.match(html, /report-contribution-row/);
    assert.match(html, /report-bar-fill/);
    assert.match(css, /\.report-contribution-row:focus-within/);
    assert.match(css, /\.report-contribution-row:hover \.report-bar-fill/);
  });

  it("keeps contribution percentages tied to real views", () => {
    const html = renderToStaticMarkup(
      <CreatorContributionList creators={creators} totalReach={1000} />
    );

    assert.match(html, /80,0%/);
    assert.match(html, /Diğerleri/);
    assert.match(html, /20,0%/);
  });
});
