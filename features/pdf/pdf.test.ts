import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  assertExportableVersion,
  buildPrintPayloadFromSnapshot,
  isExportableVersionStatus,
} from "@/features/pdf/calculations";
import {
  EXPORT_TOKEN_MAX_TTL_SECONDS,
  PDF_MAX_BYTES,
  PDF_PAGE_OPTIONS,
  PRINT_ASSET_TIMEOUT_MS,
  PDF_READY_SELECTOR,
} from "@/features/pdf/constants";
import { decidePrintRequest } from "@/features/pdf/services/print-request-policy";
import { ReportPdfError, toTurkishPdfMessage } from "@/features/pdf/errors";
import {
  buildPrintUrl,
  isAllowedPrintUrl,
  isRawExportToken,
  isUuid,
  isValidAppUrl,
} from "@/features/pdf/origin";
import {
  buildContentDisposition,
  buildReportPdfFilename,
  slugifyForFilename,
} from "@/features/pdf/services/build-report-pdf-filename";
import {
  buildTokenExpiry,
  generateRawExportToken,
  hashExportToken,
  isTokenExpired,
  isTokenUsable,
  resolveTokenTtlSeconds,
  tokensMatch,
} from "@/features/pdf/services/export-token";
import {
  closeBrowserQuietly,
  isServerlessRuntime,
} from "@/features/pdf/services/browser-lifecycle";
import { serializeReportSnapshot } from "@/features/report-generation/services/serialize-report-snapshot";
import type { CampaignReportData } from "@/features/reports/types";

const APP_ORIGIN = "https://reports.example.com";
const CAMPAIGN_ID = "11111111-2222-4333-8444-555555555555";
const VERSION_ID = "66666666-7777-4888-8999-aaaaaaaaaaaa";

const liveReportFixture: CampaignReportData = {
  campaign: {
    id: CAMPAIGN_ID,
    name: "Midnight Drive",
    artist: "Artist",
    track: "Track",
    client: "Client",
    status: "active",
    startDate: "2026-01-01",
    endDate: "2026-02-01",
    soundUrl: "https://tiktok.com/sound",
    coverColor: "#1e1b4b",
  },
  totalReach: {
    label: "Total Reach",
    value: 1000,
    previousValue: 500,
    growthSinceStart: 100,
  },
  summary: { headline: "", paragraphs: [] },
  kpis: [
    {
      id: "engagement-rate",
      label: "Avg. Engagement Rate",
      value: 10,
      previousValue: 0,
      format: "percent",
    },
  ],
  trend: [{ date: "2026-01-01", views: 500, engagement: 50 }],
  growth: [{ date: "1 Ocak", views: 500, cumulativeViews: 500 }],
  platforms: [],
  featuredVideo: null,
  topVideo: null,
  creators: [],
  videos: [],
  soundGrowth: {
    soundName: "Track",
    initialUses: 0,
    currentUses: 0,
    multiplier: 0,
    timeline: [],
  },
  metadata: {
    reportNumber: "RPT-2026-0047",
    reportDate: "1 Ocak 2026",
    hasReportRecord: true,
    freshness: {
      lastSuccessfulSyncAt: null,
      videosWithoutMetrics: 0,
      staleVideoCount: 0,
    },
  },
  hasTimeline: false,
  hasSoundTimeline: false,
};

function buildSnapshot(versionNumber = 2) {
  return serializeReportSnapshot(liveReportFixture, {
    reportId: "99999999-8888-4777-8666-555555555555",
    reportNumber: "RPT-2026-0047",
    sourceLastSyncedAt: null,
    versionNumber,
    reportVersionId: VERSION_ID,
    generatedAt: "2026-03-01T09:00:00.000Z",
    generatedBy: "user-1",
  });
}

describe("buildReportPdfFilename", () => {
  it("builds a lowercase ASCII filename from campaign and report number", () => {
    const filename = buildReportPdfFilename({
      campaignName: "Midnight Drive",
      reportNumber: "RPT-2026-0047",
      versionNumber: 2,
    });

    assert.equal(filename, "befluencer-midnight-drive-rpt-2026-0047-v2.pdf");
  });

  it("normalizes Turkish characters", () => {
    const filename = buildReportPdfFilename({
      campaignName: "Şarkı Güçlü İçerik Öğün",
      reportNumber: null,
      versionNumber: 1,
    });

    assert.equal(filename, "befluencer-sarki-guclu-icerik-ogun-v1.pdf");
    assert.match(filename, /^[a-z0-9.-]+$/);
  });

  it("removes unsafe path characters", () => {
    const filename = buildReportPdfFilename({
      campaignName: '../../etc/passwd "drop"\\x',
      reportNumber: null,
      versionNumber: 3,
    });

    assert.match(filename, /^[a-z0-9.-]+$/);
    assert.equal(filename.includes("/"), false);
    assert.equal(filename.includes(".."), false);
  });

  it("falls back when no usable name parts remain", () => {
    assert.equal(
      buildReportPdfFilename({
        campaignName: "###",
        reportNumber: "",
        versionNumber: 2,
      }),
      "befluencer-report-v2.pdf"
    );
  });

  it("keeps the filename within a reasonable length", () => {
    const filename = buildReportPdfFilename({
      campaignName: "a".repeat(400),
      reportNumber: "b".repeat(400),
      versionNumber: 12,
    });

    assert.ok(filename.length <= 120, `length was ${filename.length}`);
    assert.ok(filename.endsWith("-v12.pdf"));
  });

  it("falls back for an invalid version number", () => {
    assert.equal(
      buildReportPdfFilename({
        campaignName: "###",
        reportNumber: null,
        versionNumber: Number.NaN,
      }),
      "befluencer-report-v1.pdf"
    );
  });

  it("produces a header-safe Content-Disposition", () => {
    const disposition = buildContentDisposition('bad"name;.pdf');

    assert.equal(disposition, 'attachment; filename="badname.pdf"');
    assert.equal(disposition.includes('";'), false);
  });

  it("slugifies to empty for symbol-only input", () => {
    assert.equal(slugifyForFilename("!!!"), "");
  });
});

describe("export token", () => {
  it("creates a 64 character hex token and stores only its hash", () => {
    const token = generateRawExportToken();

    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal(isRawExportToken(token), true);

    const hash = hashExportToken(token);

    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.notEqual(hash, token);
    assert.equal(hash, createHash("sha256").update(token, "utf8").digest("hex"));
  });

  it("hashes deterministically and compares in constant time", () => {
    const token = generateRawExportToken();

    assert.equal(tokensMatch(hashExportToken(token), hashExportToken(token)), true);
    assert.equal(
      tokensMatch(hashExportToken(token), hashExportToken(generateRawExportToken())),
      false
    );
  });

  it("rejects malformed raw tokens", () => {
    assert.equal(isRawExportToken(""), false);
    assert.equal(isRawExportToken("zz"), false);
    assert.equal(isRawExportToken("A".repeat(64)), false);
    assert.equal(isRawExportToken(`${"a".repeat(64)}extra`), false);
  });

  it("clamps the token lifetime to the database maximum", () => {
    assert.equal(resolveTokenTtlSeconds(60), 60);
    assert.equal(resolveTokenTtlSeconds(99_999), EXPORT_TOKEN_MAX_TTL_SECONDS);
    assert.equal(resolveTokenTtlSeconds(0), 120);
    assert.equal(resolveTokenTtlSeconds(Number.NaN), 120);
  });

  it("treats an elapsed expiry as expired", () => {
    const now = new Date("2026-03-01T10:00:00.000Z");

    assert.equal(isTokenExpired("2026-03-01T09:59:59.000Z", now), true);
    assert.equal(isTokenExpired("2026-03-01T10:00:00.000Z", now), true);
    assert.equal(isTokenExpired("2026-03-01T10:02:00.000Z", now), false);
    assert.equal(isTokenExpired("not-a-date", now), true);
  });

  it("computes an expiry within the maximum lifetime", () => {
    const now = new Date("2026-03-01T10:00:00.000Z");
    const expiresAt = buildTokenExpiry(now, 99_999);
    const elapsed = new Date(expiresAt).getTime() - now.getTime();

    assert.ok(elapsed <= EXPORT_TOKEN_MAX_TTL_SECONDS * 1000);
  });

  it("rejects an already used token", () => {
    const now = new Date("2026-03-01T10:00:00.000Z");

    assert.equal(
      isTokenUsable({ expiresAt: "2026-03-01T10:02:00.000Z", usedAt: null }, now),
      true
    );
    assert.equal(
      isTokenUsable(
        { expiresAt: "2026-03-01T10:02:00.000Z", usedAt: "2026-03-01T10:00:30.000Z" },
        now
      ),
      false
    );
  });
});

describe("application origin validation", () => {
  it("accepts http and https origins only", () => {
    assert.equal(isValidAppUrl("http://localhost:3000"), true);
    assert.equal(isValidAppUrl("https://reports.example.com"), true);
    assert.equal(isValidAppUrl("https://reports.example.com/"), true);
    assert.equal(isValidAppUrl("ftp://reports.example.com"), false);
    assert.equal(isValidAppUrl("javascript:alert(1)"), false);
    assert.equal(isValidAppUrl("reports.example.com"), false);
    assert.equal(isValidAppUrl("https://reports.example.com/path"), false);
    assert.equal(isValidAppUrl("https://reports.example.com?x=1"), false);
    assert.equal(isValidAppUrl(""), false);
  });

  it("builds a same-origin print URL carrying the token", () => {
    const token = "a".repeat(64);
    const url = buildPrintUrl({
      appOrigin: APP_ORIGIN,
      campaignId: CAMPAIGN_ID,
      reportVersionId: VERSION_ID,
      token,
    });

    const parsed = new URL(url);

    assert.equal(parsed.origin, APP_ORIGIN);
    assert.equal(
      parsed.pathname,
      `/campaigns/${CAMPAIGN_ID}/reports/${VERSION_ID}/print`
    );
    assert.equal(parsed.searchParams.get("token"), token);
  });

  it("rejects non-uuid identifiers so no arbitrary path can be injected", () => {
    assert.throws(
      () =>
        buildPrintUrl({
          appOrigin: APP_ORIGIN,
          campaignId: "../../admin",
          reportVersionId: VERSION_ID,
          token: "a".repeat(64),
        }),
      ReportPdfError
    );

    assert.throws(
      () =>
        buildPrintUrl({
          appOrigin: APP_ORIGIN,
          campaignId: CAMPAIGN_ID,
          reportVersionId: "https://evil.example.com",
          token: "a".repeat(64),
        }),
      ReportPdfError
    );
  });

  it("rejects a malformed token", () => {
    assert.throws(
      () =>
        buildPrintUrl({
          appOrigin: APP_ORIGIN,
          campaignId: CAMPAIGN_ID,
          reportVersionId: VERSION_ID,
          token: "short",
        }),
      ReportPdfError
    );
  });

  it("only allows navigation to the configured origin", () => {
    assert.equal(isAllowedPrintUrl(`${APP_ORIGIN}/anything`, APP_ORIGIN), true);
    assert.equal(isAllowedPrintUrl("https://evil.example.com/x", APP_ORIGIN), false);
    assert.equal(isAllowedPrintUrl("http://reports.example.com/x", APP_ORIGIN), false);
    assert.equal(isAllowedPrintUrl("file:///etc/passwd", APP_ORIGIN), false);
    assert.equal(isAllowedPrintUrl("not a url", APP_ORIGIN), false);
  });

  it("validates uuid identifiers", () => {
    assert.equal(isUuid(CAMPAIGN_ID), true);
    assert.equal(isUuid("nope"), false);
  });
});

describe("exportable version status", () => {
  it("allows ready and archived versions", () => {
    assert.equal(isExportableVersionStatus("ready"), true);
    assert.equal(isExportableVersionStatus("archived"), true);
  });

  it("rejects generating and failed versions", () => {
    assert.equal(isExportableVersionStatus("generating"), false);
    assert.equal(isExportableVersionStatus("failed"), false);
  });

  it("rejects a version belonging to another campaign", () => {
    assert.throws(
      () =>
        assertExportableVersion(
          { campaign_id: "other-campaign", status: "ready" },
          CAMPAIGN_ID
        ),
      (error: unknown) =>
        error instanceof ReportPdfError && error.code === "report_not_found"
    );
  });

  it("rejects a missing version", () => {
    assert.throws(
      () => assertExportableVersion(null, CAMPAIGN_ID),
      (error: unknown) =>
        error instanceof ReportPdfError && error.code === "report_not_found"
    );
  });

  it("rejects a generating version with report_not_ready", () => {
    assert.throws(
      () =>
        assertExportableVersion(
          { campaign_id: CAMPAIGN_ID, status: "generating" },
          CAMPAIGN_ID
        ),
      (error: unknown) =>
        error instanceof ReportPdfError && error.code === "report_not_ready"
    );
  });

  it("accepts a matching ready version", () => {
    assert.doesNotThrow(() =>
      assertExportableVersion({ campaign_id: CAMPAIGN_ID, status: "ready" }, CAMPAIGN_ID)
    );
  });
});

describe("buildPrintPayloadFromSnapshot", () => {
  const baseInput = {
    reportVersionId: VERSION_ID,
    campaignId: CAMPAIGN_ID,
    versionNumber: 2,
    status: "ready",
    generatedAt: "2026-03-01T09:00:00.000Z",
    sourceLastSyncedAt: null,
    campaignName: "Midnight Drive",
    reportNumber: "RPT-2026-0047",
  };

  it("renders only from the stored snapshot", () => {
    const snapshot = JSON.parse(JSON.stringify(buildSnapshot(2)));
    const payload = buildPrintPayloadFromSnapshot({ ...baseInput, snapshot });

    assert.equal(payload.versionNumber, 2);
    assert.equal(payload.reportNumber, "RPT-2026-0047");
    assert.equal(payload.campaignName, "Midnight Drive");
    assert.equal(payload.report.totalReach.value, 1000);
    assert.equal(payload.report.metadata.reportDate, "1 Ocak 2026");
  });

  it("prefers snapshot metadata over live row columns", () => {
    const snapshot = JSON.parse(JSON.stringify(buildSnapshot(5)));
    const payload = buildPrintPayloadFromSnapshot({
      ...baseInput,
      versionNumber: 99,
      reportNumber: "RPT-LIVE-CHANGED",
      campaignName: "Renamed Later",
      snapshot,
    });

    assert.equal(payload.versionNumber, 5);
    assert.equal(payload.reportNumber, "RPT-2026-0047");
    assert.equal(payload.campaignName, "Midnight Drive");
  });

  it("accepts archived versions", () => {
    const snapshot = JSON.parse(JSON.stringify(buildSnapshot(2)));
    const payload = buildPrintPayloadFromSnapshot({
      ...baseInput,
      status: "archived",
      snapshot,
    });

    assert.equal(payload.status, "archived");
  });

  it("rejects generating and failed versions", () => {
    const snapshot = JSON.parse(JSON.stringify(buildSnapshot(2)));

    for (const status of ["generating", "failed"]) {
      assert.throws(
        () => buildPrintPayloadFromSnapshot({ ...baseInput, status, snapshot }),
        (error: unknown) =>
          error instanceof ReportPdfError && error.code === "report_not_ready"
      );
    }
  });

  it("rejects an invalid snapshot", () => {
    assert.throws(
      () => buildPrintPayloadFromSnapshot({ ...baseInput, snapshot: { broken: true } }),
      (error: unknown) =>
        error instanceof ReportPdfError && error.code === "invalid_snapshot"
    );
  });

  it("rejects an empty snapshot from a version that never finished", () => {
    assert.throws(
      () => buildPrintPayloadFromSnapshot({ ...baseInput, snapshot: {} }),
      (error: unknown) =>
        error instanceof ReportPdfError && error.code === "invalid_snapshot"
    );
  });
});

describe("pdf error sanitization", () => {
  it("returns Turkish messages without internal detail", () => {
    const error = new ReportPdfError("browser_launch_failed", "/usr/bin/chrome missing");

    assert.equal(
      toTurkishPdfMessage(error),
      "PDF oluşturucu başlatılamadı. Lütfen daha sonra tekrar deneyin."
    );
    assert.equal(toTurkishPdfMessage(error).includes("/usr/bin"), false);
    assert.equal(error.status, 500);
  });

  it("maps unknown errors to a generic Turkish message", () => {
    assert.equal(
      toTurkishPdfMessage(new Error("Supabase: permission denied for table")),
      "PDF oluşturulamadı. Lütfen tekrar deneyin."
    );
  });

  it("uses distinct status codes per failure kind", () => {
    assert.equal(new ReportPdfError("report_not_found").status, 404);
    assert.equal(new ReportPdfError("report_not_ready").status, 409);
    assert.equal(new ReportPdfError("invalid_snapshot").status, 422);
    assert.equal(new ReportPdfError("print_ready_timeout").status, 504);
    assert.equal(new ReportPdfError("unauthorized").status, 401);
  });
});

describe("browser lifecycle", () => {
  it("closes the browser and swallows close failures", async () => {
    let closed = 0;

    await closeBrowserQuietly({
      close: async () => {
        closed += 1;
      },
    } as unknown as Parameters<typeof closeBrowserQuietly>[0]);

    assert.equal(closed, 1);

    await assert.doesNotReject(() =>
      closeBrowserQuietly({
        close: async () => {
          throw new Error("already exited");
        },
      } as unknown as Parameters<typeof closeBrowserQuietly>[0])
    );

    await assert.doesNotReject(() => closeBrowserQuietly(null));
  });

  it("detects the serverless runtime from environment flags only", () => {
    const previous = process.env.VERCEL;

    try {
      delete process.env.VERCEL;
      assert.equal(isServerlessRuntime(), false);

      process.env.VERCEL = "1";
      assert.equal(isServerlessRuntime(), true);
    } finally {
      if (previous === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = previous;
      }
    }
  });
});

describe("pdf response contract", () => {
  it("uses A4 portrait with printBackground and no puppeteer header", () => {
    assert.equal(PDF_PAGE_OPTIONS.format, "A4");
    assert.equal(PDF_PAGE_OPTIONS.printBackground, true);
    assert.equal(PDF_PAGE_OPTIONS.preferCSSPageSize, true);
    assert.equal(PDF_PAGE_OPTIONS.landscape, false);
    assert.equal(PDF_PAGE_OPTIONS.margin.top, "14mm");
    assert.equal(PDF_PAGE_OPTIONS.margin.right, "12mm");
    assert.equal(PDF_PAGE_OPTIONS.margin.bottom, "16mm");
    assert.equal(PDF_PAGE_OPTIONS.margin.left, "12mm");
  });

  it("waits on a deterministic readiness marker", () => {
    assert.equal(PDF_READY_SELECTOR, '[data-pdf-ready="true"]');
  });

  it("bounds image settling so a failed CDN thumbnail cannot hang export", () => {
    assert.ok(PRINT_ASSET_TIMEOUT_MS > 0);
    assert.ok(PRINT_ASSET_TIMEOUT_MS <= 15_000);
  });

  it("allows passive http(s) image requests from provider CDNs", () => {
    assert.equal(
      decidePrintRequest({
        url: "https://p16-sign-va.tiktokcdn.com/obj/expired.jpeg?x-expires=1",
        resourceType: "image",
        isNavigationRequest: false,
        appOrigin: "https://reports.example.com",
      }),
      "continue"
    );
  });

  it("blocks external social document navigation during PDF capture", () => {
    assert.equal(
      decidePrintRequest({
        url: "https://www.tiktok.com/@creator/video/123",
        resourceType: "document",
        isNavigationRequest: true,
        appOrigin: "https://reports.example.com",
      }),
      "abort"
    );
  });

  it("treats image error listeners as settled readiness in the generator", () => {
    const source = readFileSync(
      "features/pdf/services/generate-report-pdf.ts",
      "utf8"
    );
    assert.match(source, /addEventListener\("error"/);
    assert.match(source, /addEventListener\("load"/);
  });

  it("builds private, non-sniffable attachment headers", () => {
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Content-Disposition": buildContentDisposition(
        buildReportPdfFilename({
          campaignName: "Midnight Drive",
          reportNumber: "RPT-2026-0047",
          versionNumber: 2,
        })
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });

    assert.equal(headers.get("Content-Type"), "application/pdf");
    assert.equal(
      headers.get("Content-Disposition"),
      'attachment; filename="befluencer-midnight-drive-rpt-2026-0047-v2.pdf"'
    );
    assert.equal(headers.get("Cache-Control"), "private, no-store");
    assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  });

  it("enforces a PDF size sanity limit", () => {
    assert.ok(PDF_MAX_BYTES > 0);
    assert.ok(PDF_MAX_BYTES <= 50 * 1024 * 1024);
  });
});
