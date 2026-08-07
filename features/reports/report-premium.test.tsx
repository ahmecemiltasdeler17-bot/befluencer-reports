import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { ReportFooter } from "@/components/report/report-footer";
import { ReportHeader } from "@/components/report/report-header";
import { ReportKpiCard } from "@/components/report/report-kpi-card";
import {
  buildReportOverviewMetrics,
  ReportOverviewSection,
} from "@/components/report/report-overview-section";
import {
  formatReportPeriod,
  reportContextLabel,
} from "@/components/report/report-presentation";
import { ReportSection } from "@/components/report/report-section";
import { ReportWatermark } from "@/components/report/report-watermark";
import type { Campaign, DashboardData } from "@/lib/types";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const campaign: Campaign = {
  id: "11111111-2222-4333-8444-555555555555",
  name: "Summer Drop",
  artist: "Artist",
  track: "Track One",
  client: "Brand Co",
  status: "active",
  startDate: "2026-06-01",
  endDate: "2026-07-01",
  soundUrl: "https://www.tiktok.com/music/x-123",
  coverColor: "#111",
};

const overviewInput: Pick<
  DashboardData,
  "kpis" | "creators" | "videos" | "totalReach" | "soundGrowth"
> = {
  kpis: [
    {
      id: "engagement-rate",
      label: "ER",
      value: 4.5,
      previousValue: 0,
      format: "percent",
    },
    {
      id: "creators",
      label: "Creators",
      value: 2,
      previousValue: 0,
      format: "number",
    },
    {
      id: "videos-live",
      label: "Videos",
      value: 3,
      previousValue: 0,
      format: "number",
    },
  ],
  creators: [
    {
      id: "c1",
      rank: 1,
      handle: "@very_long_username_example",
      displayName: "Display",
      avatar: "",
      followers: 1200,
      videos: 1,
      views: 1000,
      engagement: 100,
      engagementRate: 4,
      category: "micro",
      platform: "tiktok",
      profileUrl: "https://www.tiktok.com/@very_long_username_example",
    },
  ],
  videos: [
    {
      id: "v1",
      title: "A caption that should clamp safely in the card layout",
      creatorHandle: "@very_long_username_example",
      creatorName: "Display",
      creatorAvatar: "",
      thumbnail: "",
      platform: "tiktok",
      views: 1000,
      likes: 50,
      comments: 10,
      shares: 5,
      saves: 2,
      engagementRate: 4,
      publishedAt: "2026-06-10",
      url: "https://www.tiktok.com/@x/video/1",
      category: "micro",
      hasMetrics: true,
    },
  ],
  totalReach: {
    value: 1000,
    previousValue: 0,
    label: "reach",
    growthSinceStart: null,
  },
  soundGrowth: {
    soundName: "Track One",
    initialUses: 10,
    currentUses: 40,
    multiplier: 4,
    timeline: [],
  },
};

describe("report presentation labels", () => {
  it("maps live/historical/public labels", () => {
    assert.equal(reportContextLabel("live"), "Canlı Rapor");
    assert.equal(reportContextLabel("historical"), "Kayıtlı Rapor");
    assert.equal(reportContextLabel("archived"), "Arşivlenmiş Rapor");
    assert.equal(reportContextLabel("public"), "Paylaşılan Rapor");
  });

  it("formats campaign period in Turkish", () => {
    assert.match(formatReportPeriod("2026-06-01", "2026-07-01") ?? "", /2026/);
  });
});

describe("premium report hero and overview", () => {
  it("renders campaign context in the cover/hero metadata", () => {
    const html = renderToStaticMarkup(
      <ReportHeader
        campaign={campaign}
        reportNumber="RPT-1"
        reportDate="10 Haziran 2026"
        presentationContext="live"
        versionLabel="Sürüm v2"
        soundGrowth={overviewInput.soundGrowth}
      />
    );

    assert.match(html, /BeFluencer/);
    assert.match(html, /Brand Co/);
    assert.match(html, /Canlı Rapor/);
    assert.match(html, /TikTok/);
    assert.match(html, /Dönem/);
    assert.match(html, /Kampanya sesi/);
    assert.match(html, /Sürüm v2/);
    assert.equal(html.includes("Create Next App"), false);
    assert.equal(html.includes(campaign.id), false);
    assert.equal(html.includes("internal"), false);
    assert.equal(html.includes("fee"), false);
  });

  it("builds primary overview KPIs without invented fallbacks", () => {
    const metrics = buildReportOverviewMetrics(overviewInput);
    assert.equal(metrics.totalViews, 1000);
    assert.equal(metrics.totalLikes, 50);
    assert.equal(metrics.creatorCount, 2);
    assert.equal(metrics.videoCount, 3);
    assert.equal(metrics.engagementRate, 4.5);
    assert.equal(metrics.soundUses, 40);

    const html = renderToStaticMarkup(
      <ReportOverviewSection data={overviewInput} />
    );
    assert.match(html, /Genel Bakış/);
    assert.match(html, /Toplam İzlenme/);
    assert.match(html, /Etkileşim Oranı/);
    assert.equal(html.includes("%7,2"), false);
    assert.equal(html.includes("156"), false);
  });

  it("keeps exact KPI values available via accessibility labels", () => {
    const html = renderToStaticMarkup(
      <ReportKpiCard
        label="Beğeni"
        value="50"
        exactLabel="50"
        helper="test"
      />
    );
    assert.match(html, /aria-label="Beğeni: 50"/);
    assert.match(html, /title="50"/);
  });
});

describe("premium report structure and privacy", () => {
  it("uses shared section wrapper with print-safe class", () => {
    const html = renderToStaticMarkup(
      <ReportSection title="Test" eyebrow="Eyebrow">
        <p>content</p>
      </ReportSection>
    );
    assert.match(html, /pdf-section/);
    assert.match(html, /report-section/);
    assert.match(html, /Eyebrow/);
  });

  it("footer uses real metadata and neutral branding note", () => {
    const html = renderToStaticMarkup(
      <ReportFooter
        reportNumber="RPT-9"
        reportDate="1 Temmuz 2026"
        lastUpdated="2 Temmuz 2026"
      />
    );
    assert.match(html, /BeFluencer/);
    assert.match(html, /RPT-9/);
    assert.match(html, /Bu rapor BeFluencer raporlama altyapısı ile hazırlanmıştır/);
    assert.equal(html.includes("RPT-2026-0047"), false);
    assert.equal(html.includes("token"), false);
  });

  it("keeps watermark on the shared report surface", () => {
    const view = read("components/report/campaign-report-view.tsx");
    assert.match(view, /ReportWatermark/);
    assert.match(view, /presentationContext/);
    assert.match(view, /ReportOverviewSection|ReportHeroSection/);
    const watermark = renderToStaticMarkup(<ReportWatermark />);
    assert.match(watermark, /aria-hidden="true"/);
  });

  it("creator/video report components avoid fees and internal notes", () => {
    for (const file of [
      "components/report/content/creator-leaderboard.tsx",
      "components/report/content/creator-leaderboard-row.tsx",
      "components/report/content/tiktok-content-card.tsx",
      "components/report/report-header.tsx",
      "components/report/report-footer.tsx",
    ]) {
      const source = read(file);
      assert.equal(source.includes("internal_notes"), false);
      assert.equal(/\bfee\b/.test(source), false);
      assert.equal(source.includes("sync_error"), false);
    }
  });

  it("hides empty sound section instead of large empty card", () => {
    const source = read("components/report/sound-growth-section.tsx");
    assert.match(source, /return null/);
    assert.equal(
      source.includes("Ses kullanım grafiği için en az iki veri noktası"),
      false
    );
  });

  it("video cards clamp captions and stay page-break safe", () => {
    const source = read("components/report/content/tiktok-content-card.tsx");
    assert.match(source, /line-clamp-2/);
    assert.match(source, /pdf-avoid-break/);
    assert.match(source, /ReportVideoLink/);
  });

  it("admin surfaces remain unchanged (no CampaignReportView premium chrome)", () => {
    assert.equal(
      read("app/(protected)/(manage)/page.tsx").includes("CampaignReportView"),
      false
    );
    assert.equal(
      read("app/(protected)/(manage)/campaigns/[id]/page.tsx").includes(
        "CampaignReportView"
      ),
      false
    );
  });

  it("wires presentation context on live/historical/public/print routes", () => {
    assert.match(
      read("app/(protected)/(report)/campaigns/[id]/report/page.tsx"),
      /presentationContext="live"/
    );
    assert.match(
      read(
        "app/(protected)/(report)/campaigns/[id]/reports/[versionId]/page.tsx"
      ),
      /presentationContext=\{/
    );
    assert.match(
      read("app/(public-report)/r/[token]/page.tsx"),
      /presentationContext="public"/
    );
    assert.match(
      read(
        "app/(print)/campaigns/[id]/reports/[versionId]/print/page.tsx"
      ),
      /presentationContext=\{/
    );
  });

  it("does not invent KPI fallbacks in hero module", () => {
    const hero = read("components/report/report-hero-section.tsx");
    assert.equal(hero.includes("%7,2"), false);
    assert.equal(hero.includes("156_800"), false);
    assert.match(hero, /ReportKpiStrip/);
    assert.equal(hero.includes("overflowCount"), false);
    assert.equal(hero.includes("maxVisible"), false);
  });
});
