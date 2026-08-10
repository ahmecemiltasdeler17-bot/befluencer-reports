import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { ReportWatermark } from "@/components/report/report-watermark";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("report watermark component", () => {
  it("renders a non-interactive aria-hidden layer without token leakage", () => {
    const html = renderToStaticMarkup(<ReportWatermark />);

    assert.match(html, /data-report-watermark/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /report-watermark/);
    assert.equal(html.includes("token"), false);
    assert.equal(html.includes("/r/"), false);
    // No repeated text nodes — tiling is CSS background only.
    assert.equal(html.includes("BeFluencer"), false);
  });

  it("documents pointer-events none and PDF page-fixed strategy in CSS", () => {
    const css = read("app/globals.css");

    assert.match(css, /\.report-watermark\s*\{/);
    assert.match(css, /pointer-events:\s*none/);
    assert.match(css, /user-select:\s*none/);
    assert.match(css, /BeFluencer/);
    assert.match(css, /rotate\(-28/);
    assert.match(css, /print-color-adjust:\s*exact/);
    assert.match(css, /\.pdf-document \.report-watermark/);
    assert.match(css, /position:\s*fixed/);

    const watermarkBlock = css.match(
      /\.report-watermark\s*\{[\s\S]*?\n\}/
    )?.[0];
    assert.ok(watermarkBlock);
    assert.equal(watermarkBlock!.includes("animation"), false);
  });
});

describe("report watermark surface wiring", () => {
  it("is mounted from CampaignReportView (shared live/historical/public/PDF layer)", () => {
    const view = read("components/report/campaign-report-view.tsx");

    assert.match(view, /ReportWatermark/);
    assert.match(view, /report-surface/);
    assert.match(view, /report-surface__content/);
    assert.match(view, /isolate/);
    assert.match(view, /z-\[1\]/);
  });

  it("is present on live report via CampaignReportView", () => {
    const page = read(
      "app/(protected)/(report)/campaigns/[id]/report/page.tsx"
    );
    assert.match(page, /CampaignReportView/);
    assert.equal(page.includes("ManagementNav"), false);
  });

  it("is present on historical report via CampaignReportView", () => {
    const page = read(
      "app/(protected)/(report)/campaigns/[id]/reports/[versionId]/page.tsx"
    );
    assert.match(page, /CampaignReportView/);
  });

  it("is present on public shared report via CampaignReportView", () => {
    const page = read("app/(public-report)/r/[token]/page.tsx");
    assert.match(page, /CampaignReportView/);
    assert.equal(page.includes("ReportWatermark"), false);
  });

  it("is present in PDF/print route markup chain", () => {
    const page = read(
      "app/(print)/campaigns/[id]/reports/[versionId]/print/page.tsx"
    );
    assert.match(page, /CampaignReportView/);
    assert.match(page, /ReportCanvas/);
    assert.match(page, /\bpdf\b/);
    assert.match(page, /PdfReadyMarker/);

    const canvas = read("components/report/report-canvas.tsx");
    assert.match(canvas, /pdf-document/);

    const view = read("components/report/campaign-report-view.tsx");
    assert.match(view, /ReportWatermark/);
  });

  it("keeps printBackground enabled for watermark visibility in PDF", () => {
    const constants = read("features/pdf/constants.ts");
    assert.match(constants, /printBackground:\s*true/);
  });
});

describe("report watermark absence on admin surfaces", () => {
  it("is absent from dashboard home", () => {
    const page = read("app/(protected)/(manage)/page.tsx");
    assert.equal(page.includes("ReportWatermark"), false);
    assert.equal(page.includes("CampaignReportView"), false);
  });

  it("is absent from creator lists", () => {
    const page = read("app/(protected)/(manage)/creator-lists/page.tsx");
    assert.equal(page.includes("ReportWatermark"), false);
    assert.equal(page.includes("CampaignReportView"), false);
  });

  it("is absent from campaign management form", () => {
    const page = read("app/(protected)/(manage)/campaigns/new/page.tsx");
    assert.equal(page.includes("ReportWatermark"), false);
    assert.equal(page.includes("CampaignReportView"), false);
  });

  it("is absent from campaign detail management page", () => {
    const page = read("app/(protected)/(manage)/campaigns/[id]/page.tsx");
    assert.equal(page.includes("ReportWatermark"), false);
    assert.equal(page.includes("CampaignReportView"), false);
  });

  it("is absent from report comparison (table only)", () => {
    const page = read(
      "app/(protected)/(manage)/campaigns/[id]/reports/compare/page.tsx"
    );
    assert.equal(page.includes("CampaignReportView"), false);
    assert.equal(page.includes("ReportWatermark"), false);
  });

  it("is absent from /dev/report-preview (not the shared report surface)", () => {
    const page = read(
      "app/(protected)/(manage)/dev/report-preview/page.tsx"
    );
    assert.equal(page.includes("CampaignReportView"), false);
    assert.equal(page.includes("ReportWatermark"), false);
  });
});

describe("report watermark interaction safety", () => {
  it("keeps content above watermark so links remain interactive", () => {
    const view = read("components/report/campaign-report-view.tsx");
    const watermarkIndex = view.indexOf("<ReportWatermark");
    const contentIndex = view.indexOf("report-surface__content");
    assert.ok(watermarkIndex >= 0);
    assert.ok(contentIndex > watermarkIndex);
  });

  it("does not put raw share tokens in watermark CSS or footer helpers", () => {
    const css = read("app/globals.css");
    const watermark = read("components/report/report-watermark.tsx");
    const footer = read("components/report/report-print-footer.tsx");

    for (const source of [css, watermark, footer]) {
      assert.equal(
        /p_raw_token|token_hash|\/r\/[0-9a-f]{64}/i.test(source),
        false
      );
    }
  });
});
