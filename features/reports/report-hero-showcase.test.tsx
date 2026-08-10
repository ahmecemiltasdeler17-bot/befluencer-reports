import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { ReportHeader } from "@/components/report/report-header";
import {
  dedupeShowcaseCreators,
  ReportCreatorShowcase,
  splitShowcaseRows,
  type ShowcaseCreator,
} from "@/components/report/report-creator-showcase";
import {
  resolvePrimaryMetricLabel,
  TotalReachHero,
} from "@/components/report/total-reach-hero";
import type { Campaign } from "@/lib/types";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function makeCreators(count: number): ShowcaseCreator[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `creator-${index}`,
    avatar: "",
    name: `Creator ${index}`,
    handle: `@user_${index}`,
    platform: "tiktok" as const,
    profileUrl: `https://www.tiktok.com/@user_${index}`,
  }));
}

describe("report creator showcase", () => {
  it("renders every creator when count exceeds the old 11-avatar limit", () => {
    const creators = makeCreators(30);
    const html = renderToStaticMarkup(
      <ReportCreatorShowcase creators={creators} />
    );

    assert.match(html, /data-report-creator-showcase/);
    assert.match(html, /data-creator-count="30"/);
    assert.match(html, /report-creator-showcase--motion/);
    // Visual marquee clones double the DOM nodes; AT-facing items exclude clones.
    const items = html.match(/report-creator-showcase__item/g) ?? [];
    const clones = html.match(/report-creator-showcase__clone/g) ?? [];
    assert.equal(items.length, 60);
    assert.equal(clones.length, 30);
    for (let index = 0; index < 30; index += 1) {
      assert.match(html, new RegExp(`@user_${index}`));
    }
    assert.equal(html.includes("+21"), false);
    assert.equal(html.includes("+19"), false);
    assert.equal(html.includes("+N"), false);
    assert.equal(
      html.includes('class="report-creator-showcase__overflow"') ||
        html.includes("overflowCount"),
      false
    );
  });

  it("does not clone avatars when the set is too small for marquee", () => {
    const html = renderToStaticMarkup(
      <ReportCreatorShowcase creators={makeCreators(4)} />
    );
    assert.equal(html.includes("report-creator-showcase--motion"), false);
    assert.equal(html.includes("report-creator-showcase__clone"), false);
    assert.equal(
      (html.match(/report-creator-showcase__item/g) ?? []).length,
      4
    );
  });

  it("splits large showcase sets into two visual rows", () => {
    const [a, b] = splitShowcaseRows(makeCreators(20));
    assert.equal(a.length + b.length, 20);
    assert.equal(a.length, 10);
    assert.equal(b.length, 10);
  });

  it("renders 100 creators without an overflow badge", () => {
    const html = renderToStaticMarkup(
      <ReportCreatorShowcase creators={makeCreators(100)} />
    );
    assert.match(html, /data-creator-count="100"/);
    // One accessible name per real creator (clones are aria-hidden / no sr-only).
    assert.equal((html.match(/sr-only/g) ?? []).length >= 100, true);
    assert.equal(/\+\d+/.test(html), false);
  });

  it("deduplicates creators by stable id and preserves order", () => {
    const creators = [
      ...makeCreators(3),
      { ...makeCreators(1)[0], name: "Duplicate" },
    ];
    const unique = dedupeShowcaseCreators(creators);
    assert.equal(unique.length, 3);
    assert.equal(unique[0].id, "creator-0");
    assert.equal(unique[0].name, "Creator 0");
  });

  it("keeps creator links and accessible names", () => {
    const html = renderToStaticMarkup(
      <ReportCreatorShowcase creators={makeCreators(2)} />
    );
    assert.match(html, /href="https:\/\/www\.tiktok\.com\/@user_0"/);
    assert.match(html, /@user_0/);
    assert.match(html, /report-creator-showcase__link/);
  });

  it("renders branded fallback for missing avatars and tolerates long handles", () => {
    const longHandle =
      "@this_is_an_extremely_long_username_that_must_not_break_markup";
    const html = renderToStaticMarkup(
      <ReportCreatorShowcase
        creators={[
          {
            id: "missing-avatar",
            avatar: "",
            name: "Fallback Creator",
            handle: longHandle,
            platform: "tiktok",
            profileUrl: `https://www.tiktok.com/${longHandle}`,
          },
        ]}
      />
    );
    assert.match(html, /Fallback Creator|FC/);
    assert.match(html, /sr-only/);
    assert.equal(html.includes("<img"), false);
    assert.equal(html.includes(longHandle.replace(/^@/, "")), true);
  });

  it("uses print-safe showcase classes and disables marquee clones in PDF", () => {
    const css = read("app/globals.css");
    assert.match(css, /\.report-creator-showcase/);
    assert.match(css, /\.pdf-document \.report-creator-showcase/);
    assert.match(css, /flex-wrap:\s*wrap/);
    assert.match(
      css,
      /\.pdf-document \.report-creator-showcase--motion \.report-creator-showcase__clone/
    );
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    const component = read("components/report/report-creator-showcase.tsx");
    assert.match(component, /pdf-avoid-break/);
    assert.match(component, /decorative/);
    assert.equal(component.includes("maxVisible"), false);
    assert.equal(component.includes("overflowCount"), false);
  });
});

describe("report impact hero", () => {
  it("shows campaign title and accessible primary metric", () => {
    assert.equal(resolvePrimaryMetricLabel("Total Reach"), "Toplam İzlenme");
    assert.equal(resolvePrimaryMetricLabel("Toplam Erişim"), "Toplam Erişim");

    const html = renderToStaticMarkup(
      <TotalReachHero
        campaignTitle="Summer Drop"
        subtitle="Artist · Track"
        totalReach={{
          value: 1_250_000,
          previousValue: 0,
          label: "Total Reach",
          growthSinceStart: null,
        }}
        creators={makeCreators(5)}
      />
    );

    assert.match(html, /Summer Drop/);
    assert.match(html, /Toplam İzlenme/);
    assert.match(html, /aria-label="Toplam İzlenme: /);
    assert.match(html, /Henüz karşılaştırma yok/);
    assert.equal(html.includes("text-emerald"), false);
    assert.equal(html.includes("+21"), false);
    assert.match(html, /data-creator-count="5"/);
  });

  it("does not invent positive growth styling without comparison data", () => {
    const source = read("components/report/total-reach-hero.tsx");
    assert.equal(source.includes("emerald"), false);
    assert.equal(source.includes("TrendingUp"), false);
  });

  it("metadata header avoids framework placeholders and raw ids", () => {
    const campaign: Campaign = {
      id: "11111111-2222-4333-8444-555555555555",
      name: "Campaign",
      artist: "A",
      track: "T",
      client: "Brand",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      soundUrl: "https://www.tiktok.com/music/x-1",
      coverColor: "#000",
    };
    const html = renderToStaticMarkup(
      <ReportHeader
        campaign={campaign}
        reportNumber="RPT-9"
        reportDate="1 Şubat 2026"
        presentationContext="public"
        versionLabel="Sürüm v3"
      />
    );
    assert.match(html, /BeFluencer/);
    assert.match(html, /Paylaşılan Rapor/);
    assert.match(html, /Brand/);
    assert.equal(html.includes("Create Next App"), false);
    assert.equal(html.includes(campaign.id), false);
    assert.equal(html.includes("token"), false);
  });

  it("hero section no longer computes overflowCount / maxVisible", () => {
    const source = read("components/report/report-hero-section.tsx");
    assert.equal(source.includes("overflowCount"), false);
    assert.equal(source.includes("maxVisible"), false);
    assert.match(source, /ReportKpiStrip/);
    assert.match(source, /report-cover__glow/);
  });

  it("watermark and admin pages remain unchanged contracts", () => {
    assert.match(
      read("components/report/campaign-report-view.tsx"),
      /ReportWatermark/
    );
    assert.equal(
      read("app/(protected)/(manage)/page.tsx").includes("ReportCreatorShowcase"),
      false
    );
    assert.equal(
      read("app/(protected)/(manage)/campaigns/[id]/page.tsx").includes(
        "overflowCount"
      ),
      false
    );
  });

  it("privacy: showcase and hero omit fees/notes/tokens", () => {
    for (const file of [
      "components/report/report-creator-showcase.tsx",
      "components/report/total-reach-hero.tsx",
      "components/report/report-hero-section.tsx",
      "components/report/report-header.tsx",
    ]) {
      const source = read(file);
      assert.equal(source.includes("internal_notes"), false);
      assert.equal(/\bfee\b/.test(source), false);
      assert.equal(source.includes("token_hash"), false);
    }
  });
});
