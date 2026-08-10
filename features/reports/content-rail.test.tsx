import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { ContentCategoryGroup } from "@/components/report/content/content-category-group";
import { ContentRail } from "@/components/report/content/content-rail";
import type { Video } from "@/lib/types";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function makeVideo(index: number): Video {
  return {
    id: `v${index}`,
    title: `Video ${index}`,
    creatorHandle: `@user_${index}`,
    creatorName: `Creator ${index}`,
    creatorAvatar: "",
    thumbnail: "",
    platform: "tiktok",
    views: 1000 - index,
    likes: 10,
    comments: 2,
    shares: 1,
    saves: 1,
    engagementRate: 4,
    publishedAt: "2026-06-10",
    url: `https://www.tiktok.com/@user_${index}/video/${index}`,
    category: "micro",
    hasMetrics: true,
  };
}

describe("content rail", () => {
  it("renders every child as a rail item inside a labelled scroll group", () => {
    const html = renderToStaticMarkup(
      <ContentRail label="Mikro İçerik Üreticisi">
        {Array.from({ length: 12 }, (_, index) => (
          <p key={index}>card-{index}</p>
        ))}
      </ContentRail>
    );

    assert.equal((html.match(/report-rail__item/g) ?? []).length, 12);
    for (let index = 0; index < 12; index += 1) {
      assert.match(html, new RegExp(`card-${index}<`));
    }
    assert.match(html, /role="group"/);
    assert.match(html, /aria-label="Mikro İçerik Üreticisi"/);
    assert.match(html, /tabindex="0"/);
  });

  it("server-renders deterministic edge state with both arrows disabled", () => {
    const html = renderToStaticMarkup(
      <ContentRail label="Makro">
        <p>only</p>
      </ContentRail>
    );

    // Measured after mount; SSR must not depend on viewport size.
    assert.match(html, /data-at-start="true"/);
    assert.match(html, /data-at-end="true"/);
    assert.match(html, /data-scrollable="false"/);
    assert.match(html, /data-dragging="false"/);
    assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
    assert.match(html, /aria-label="Makro: geri kaydır"/);
    assert.match(html, /aria-label="Makro: ileri kaydır"/);
  });

  it("keeps category ordering and exposes the item count", () => {
    const videos = [makeVideo(1), makeVideo(2), makeVideo(3)];
    const html = renderToStaticMarkup(
      <ContentCategoryGroup
        category="micro"
        videos={videos}
        campaignAverageEngagement={4}
      />
    );

    assert.match(html, /3 içerik/);
    const order = [...html.matchAll(/@user_(\d)/g)].map((m) => Number(m[1]));
    assert.deepEqual(
      order.filter((value, index, all) => all.indexOf(value) === index),
      [1, 2, 3]
    );
  });

  it("never intercepts vertical wheel scrolling", () => {
    const source = read("components/report/content/content-rail.tsx");
    assert.equal(source.includes("preventDefault()"), true);
    // The only preventDefault calls are drag/click suppression, never on wheel.
    assert.equal(/onWheel=\{[^}]*preventDefault/.test(source), false);
    assert.match(source, /onWheel=\{/);
    assert.match(source, /scheduleResume/);
  });

  it("disables ambient drift for reduced motion and coarse-only pointers", () => {
    const source = read("components/report/content/content-rail.tsx");
    assert.match(source, /prefers-reduced-motion: reduce/);
    assert.match(source, /any-pointer: fine/);
    assert.match(source, /shouldEnableRailAutoplay/);
    assert.match(source, /IntersectionObserver/);
    assert.equal(source.includes("setInterval"), false);
    assert.equal(/['"]ontouchstart['"]\s*in\s*window/.test(source), false);
  });

  it("offers a poster affordance instead of a video preview", () => {
    const card = read("components/report/content/tiktok-content-card.tsx");
    const css = read("app/globals.css");

    // Report snapshots carry a cover image and an external page URL only.
    assert.equal(/<video/.test(card), false);
    assert.equal(card.includes("autoPlay"), false);
    assert.match(card, /report-content-card__watch/);
    assert.match(card, /screen-only/);
    assert.match(css, /\.report-content-card:hover \.report-content-card__poster/);
    assert.match(
      css,
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.report-content-card:hover \.report-content-card__poster/
    );
  });

  it("prints as a static grid so no card is hidden behind overflow", () => {
    const css = read("app/globals.css");

    assert.match(
      css,
      /\.pdf-document \.report-rail__viewport[\s\S]*?overflow: visible !important/
    );
    assert.match(
      css,
      /\.pdf-document \.report-rail__viewport[\s\S]*?display: grid !important/
    );
    assert.match(css, /\.pdf-document \.report-rail__nav\s*\{\s*display: none !important/);
    assert.match(css, /@media print[\s\S]*?\.report-rail__viewport[\s\S]*?overflow: visible !important/);
  });
});
