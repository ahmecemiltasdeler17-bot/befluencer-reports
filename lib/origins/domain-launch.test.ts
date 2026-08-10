import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { runDomainReadinessChecks } from "@/lib/origins/domain-check";
import {
  assertShareUrlsMatchPublicOrigin,
  expectedPublicShareUrls,
  FAKE_SHARE_TOKEN_FOR_CHECKS,
} from "@/lib/origins/share-url-self-check";
import { getPublicReportUrl } from "@/lib/origins/build-origin-url";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("share URL self-check", () => {
  it("builds expected report and list URLs from PUBLIC_REPORT_URL", () => {
    const expected = expectedPublicShareUrls(
      "https://reports.befluencer.co",
      FAKE_SHARE_TOKEN_FOR_CHECKS
    );
    assert.equal(
      expected.report,
      `https://reports.befluencer.co/r/${FAKE_SHARE_TOKEN_FOR_CHECKS}`
    );
    assert.equal(
      expected.list,
      `https://reports.befluencer.co/lists/${FAKE_SHARE_TOKEN_FOR_CHECKS}`
    );
  });

  it("matches getPublicReportUrl helpers for custom domains", () => {
    const previousApp = process.env.APP_URL;
    const previousPublic = process.env.PUBLIC_REPORT_URL;
    const previousVercel = process.env.VERCEL;
    const previousVercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const env = process.env as Record<string, string | undefined>;

    try {
      env.APP_URL = "https://app.befluencer.co";
      env.PUBLIC_REPORT_URL = "https://reports.befluencer.co";
      delete env.VERCEL;
      delete env.VERCEL_PROJECT_PRODUCTION_URL;

      const report = getPublicReportUrl(`/r/${FAKE_SHARE_TOKEN_FOR_CHECKS}`);
      const list = getPublicReportUrl(`/lists/${FAKE_SHARE_TOKEN_FOR_CHECKS}`);
      assert.equal(
        assertShareUrlsMatchPublicOrigin(
          "https://reports.befluencer.co",
          report,
          list
        ),
        true
      );
    } finally {
      if (previousApp === undefined) delete env.APP_URL;
      else env.APP_URL = previousApp;
      if (previousPublic === undefined) delete env.PUBLIC_REPORT_URL;
      else env.PUBLIC_REPORT_URL = previousPublic;
      if (previousVercel === undefined) delete env.VERCEL;
      else env.VERCEL = previousVercel;
      if (previousVercelProd === undefined) {
        delete env.VERCEL_PROJECT_PRODUCTION_URL;
      } else {
        env.VERCEL_PROJECT_PRODUCTION_URL = previousVercelProd;
      }
    }
  });

  it("keeps temporary vercel.app share shape valid", () => {
    const expected = expectedPublicShareUrls(
      "https://befluencer-reports.vercel.app"
    );
    assert.match(expected.report, /^https:\/\/befluencer-reports\.vercel\.app\/r\//);
    assert.match(
      expected.list,
      /^https:\/\/befluencer-reports\.vercel\.app\/lists\//
    );
  });
});

describe("domain readiness checks", () => {
  it("passes temporary vercel.app production config", () => {
    const report = runDomainReadinessChecks(
      {
        APP_URL: "https://befluencer-reports.vercel.app",
        PUBLIC_REPORT_URL: "https://befluencer-reports.vercel.app",
        DOMAIN_CHECK_MODE: "production",
      },
      { scanRepo: false }
    );
    assert.equal(report.ok, true);
  });

  it("passes distinct custom-domain production config", () => {
    const report = runDomainReadinessChecks(
      {
        APP_URL: "https://app.befluencer.co",
        PUBLIC_REPORT_URL: "https://reports.befluencer.co",
        DOMAIN_CHECK_MODE: "production",
      },
      { scanRepo: false }
    );
    assert.equal(report.ok, true);
  });

  it("fails production localhost APP_URL", () => {
    const report = runDomainReadinessChecks(
      {
        APP_URL: "http://localhost:3000",
        PUBLIC_REPORT_URL: "http://localhost:3000",
        DOMAIN_CHECK_MODE: "production",
        // No Vercel fallback in this snapshot.
        VERCEL: undefined,
        VERCEL_PROJECT_PRODUCTION_URL: undefined,
        VERCEL_URL: undefined,
        NODE_ENV: "production",
      },
      { scanRepo: false }
    );
    assert.equal(report.ok, false);
    assert.ok(
      report.items.some(
        (item) => item.id === "app_not_localhost" && item.status === "fail"
      )
    );
  });

  it("allows localhost in development mode", () => {
    const report = runDomainReadinessChecks(
      {
        APP_URL: "http://localhost:3000",
        PUBLIC_REPORT_URL: "http://localhost:3000",
        NODE_ENV: "development",
      },
      { scanRepo: false }
    );
    assert.equal(report.ok, true);
  });
});

describe("auth and public route guards", () => {
  it("protects admin surfaces via (protected) layout", () => {
    const protectedLayout = read("app/(protected)/layout.tsx");
    assert.match(protectedLayout, /redirect\("\/login"\)/);

    for (const relative of [
      "app/(protected)/(manage)/page.tsx",
      "app/(protected)/(manage)/campaigns/page.tsx",
      "app/(protected)/(manage)/creators/page.tsx",
      "app/(protected)/(manage)/creator-lists/page.tsx",
    ]) {
      assert.ok(read(relative).length > 0, relative);
    }
  });

  it("keeps public report and creator-list routes outside protected auth", () => {
    const publicReport = read("app/(public-report)/r/[token]/page.tsx");
    const publicList = read("app/(public-content)/lists/[token]/page.tsx");
    const publicReportLayout = read("app/(public-report)/layout.tsx");
    const publicListLayout = read("app/(public-content)/layout.tsx");

    assert.equal(publicReport.includes('redirect("/login")'), false);
    assert.equal(publicList.includes('redirect("/login")'), false);
    assert.equal(publicReportLayout.includes('redirect("/login")'), false);
    assert.equal(publicListLayout.includes('redirect("/login")'), false);
    assert.match(publicReport, /resolvePublicReportShare|PublicShareUnavailable/);
    assert.match(publicList, /resolvePublicCreatorList|PublicListUnavailable/);
  });

  it("keeps public token APIs outside protected layout and no-store", () => {
    for (const relative of [
      "app/api/public/reports/[token]/access/route.ts",
      "app/api/public/reports/[token]/pdf/route.ts",
      "app/api/public/creator-lists/[token]/access/route.ts",
      "app/api/public/creator-lists/[token]/csv/route.ts",
    ]) {
      const source = read(relative);
      assert.equal(source.includes('redirect("/login")'), false);
      assert.match(source, /no-store/);
    }

    const proxy = read("proxy.ts");
    assert.match(proxy, /\/api\/public\//);
    assert.match(proxy, /private, no-store/);
  });
});

describe("go-live documentation", () => {
  it("includes cPanel Zone Editor guidance", () => {
    const checklist = read("docs/go-live-checklist.md");
    assert.match(checklist, /Zone Editor/);
    assert.match(checklist, /app\.befluencer\.co/);
    assert.match(checklist, /reports\.befluencer\.co/);
    assert.match(checklist, /domain:check/);
    assert.match(checklist, /domain:smoke/);
    assert.match(checklist, /MX/);
  });
});
