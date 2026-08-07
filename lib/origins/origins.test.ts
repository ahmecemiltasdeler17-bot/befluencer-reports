import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildPublicCreatorListUrl } from "@/features/creator-lists/token";
import { buildPrintUrl, getAppOrigin as getPdfAppOrigin } from "@/features/pdf/origin";
import {
  buildPublicShareUrl,
  generateRawShareToken,
  hashShareToken,
} from "@/features/public-reports/token";
import {
  isLocalhostOriginCandidate,
  resolveAppUrlCandidate,
  resolveMarketingSiteUrlCandidate,
  resolvePublicReportUrlCandidate,
} from "@/lib/origins/candidates";
import { getAppOrigin } from "@/lib/origins/get-app-origin";
import { getMarketingOrigin } from "@/lib/origins/get-marketing-origin";
import { getPublicReportOrigin } from "@/lib/origins/get-public-report-origin";
import { OriginConfigError } from "@/lib/origins/types";
import {
  isValidConfiguredOrigin,
  normalizeConfiguredOrigin,
  tryNormalizeConfiguredOrigin,
} from "@/lib/origins/validate-origin";

const ENV_KEYS = [
  "APP_URL",
  "PUBLIC_REPORT_URL",
  "MARKETING_SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
  "VERCEL",
  "VERCEL_ENV",
  "NODE_ENV",
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

afterEach(() => {
  const env = process.env as Record<string, string | undefined>;
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
});

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
    return;
  }
  env[key] = value;
}

function clearOriginEnv() {
  const env = process.env as Record<string, string | undefined>;
  for (const key of ENV_KEYS) {
    delete env[key];
  }
}

describe("normalizeConfiguredOrigin", () => {
  it("accepts valid APP_URL style origins and strips trailing slash", () => {
    assert.equal(
      normalizeConfiguredOrigin("https://app.befluencer.co/"),
      "https://app.befluencer.co"
    );
    assert.equal(
      normalizeConfiguredOrigin("http://localhost:3000"),
      "http://localhost:3000"
    );
    assert.equal(
      normalizeConfiguredOrigin("https://befluencer-reports.vercel.app/"),
      "https://befluencer-reports.vercel.app"
    );
  });

  it("rejects paths, query, fragment, credentials and non-http schemes", () => {
    assert.throws(
      () => normalizeConfiguredOrigin("https://app.befluencer.co/admin"),
      (error: unknown) =>
        error instanceof OriginConfigError && error.code === "has_path"
    );
    assert.throws(
      () => normalizeConfiguredOrigin("https://app.befluencer.co?x=1"),
      (error: unknown) =>
        error instanceof OriginConfigError && error.code === "has_query"
    );
    assert.throws(
      () => normalizeConfiguredOrigin("https://app.befluencer.co#hash"),
      (error: unknown) =>
        error instanceof OriginConfigError && error.code === "has_fragment"
    );
    assert.throws(
      () => normalizeConfiguredOrigin("https://user:pass@app.befluencer.co"),
      (error: unknown) =>
        error instanceof OriginConfigError && error.code === "has_credentials"
    );
    assert.throws(
      () => normalizeConfiguredOrigin("ftp://app.befluencer.co"),
      (error: unknown) =>
        error instanceof OriginConfigError && error.code === "invalid_scheme"
    );
    assert.equal(isValidConfiguredOrigin("https://app.befluencer.co/x"), false);
    assert.equal(tryNormalizeConfiguredOrigin("not a url"), null);
  });
});

describe("origin candidates and getters", () => {
  it("lets PUBLIC_REPORT_URL win over APP_URL", () => {
    clearOriginEnv();
    process.env.APP_URL = "https://app.befluencer.co";
    process.env.PUBLIC_REPORT_URL = "https://reports.befluencer.co";

    assert.equal(
      resolvePublicReportUrlCandidate(),
      "https://reports.befluencer.co"
    );
    assert.equal(getPublicReportOrigin(), "https://reports.befluencer.co");
    assert.equal(getAppOrigin(), "https://app.befluencer.co");
  });

  it("falls PUBLIC_REPORT_URL back to APP_URL", () => {
    clearOriginEnv();
    process.env.APP_URL = "https://app.befluencer.co";

    assert.equal(
      resolvePublicReportUrlCandidate(),
      "https://app.befluencer.co"
    );
    assert.equal(getPublicReportOrigin(), "https://app.befluencer.co");
    assert.equal(getAppOrigin(), "https://app.befluencer.co");
  });

  it("normalizes trailing slash on public production origin", () => {
    clearOriginEnv();
    process.env.PUBLIC_REPORT_URL = "https://befluencer-reports.vercel.app/";
    process.env.APP_URL = "https://befluencer-reports.vercel.app/";

    assert.equal(
      getPublicReportOrigin(),
      "https://befluencer-reports.vercel.app"
    );
  });

  it("rejects invalid public origin values safely", () => {
    clearOriginEnv();
    process.env.PUBLIC_REPORT_URL = "not-a-url";
    process.env.APP_URL = "https://app.befluencer.co";

    assert.throws(
      () => getPublicReportOrigin(),
      (error: unknown) => error instanceof OriginConfigError
    );
  });

  it("uses local fallback only in development when nothing else is set", () => {
    clearOriginEnv();
    setEnv("NODE_ENV", "development");

    assert.equal(resolveAppUrlCandidate(), "http://localhost:3000");
    assert.equal(getPublicReportOrigin(), "http://localhost:3000");
  });

  it("does not use localhost fallback in production without config", () => {
    clearOriginEnv();
    setEnv("NODE_ENV", "production");

    assert.equal(resolveAppUrlCandidate(), undefined);
    assert.throws(() => getPublicReportOrigin(), OriginConfigError);
  });

  it("ignores localhost APP_URL on Vercel and uses the deployment origin", () => {
    clearOriginEnv();
    setEnv("NODE_ENV", "production");
    setEnv("VERCEL", "1");
    setEnv("VERCEL_ENV", "production");
    process.env.APP_URL = "http://localhost:3000";
    process.env.PUBLIC_REPORT_URL = "http://localhost:3000";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "befluencer-reports.vercel.app";

    assert.equal(
      resolveAppUrlCandidate(),
      "https://befluencer-reports.vercel.app"
    );
    assert.equal(
      getPublicReportOrigin(),
      "https://befluencer-reports.vercel.app"
    );
    assert.equal(isLocalhostOriginCandidate(getPublicReportOrigin()), false);
  });

  it("treats MARKETING_SITE_URL as optional", () => {
    clearOriginEnv();
    process.env.APP_URL = "https://app.befluencer.co";

    assert.equal(resolveMarketingSiteUrlCandidate(), undefined);
    assert.equal(getMarketingOrigin(), null);
  });

  it("localhost behavior remains unchanged for local non-Vercel development", () => {
    clearOriginEnv();
    setEnv("NODE_ENV", "development");
    process.env.APP_URL = "http://localhost:3000";
    process.env.PUBLIC_REPORT_URL = "http://localhost:3000";

    assert.equal(getAppOrigin(), "http://localhost:3000");
    assert.equal(getPublicReportOrigin(), "http://localhost:3000");
  });

  it("does not use request Host headers — only process.env", () => {
    clearOriginEnv();
    process.env.APP_URL = "https://trusted.example";
    assert.equal(resolveAppUrlCandidate(), "https://trusted.example");
    assert.ok(!resolveAppUrlCandidate()?.includes("evil"));
  });
});

describe("share and PDF origin wiring", () => {
  it("builds public report share URLs from PUBLIC_REPORT_URL", () => {
    clearOriginEnv();
    process.env.APP_URL = "https://app.befluencer.co";
    process.env.PUBLIC_REPORT_URL = "https://reports.befluencer.co";

    const raw = generateRawShareToken();
    const url = buildPublicShareUrl(getPublicReportOrigin(), raw);

    assert.equal(url, `https://reports.befluencer.co/r/${raw}`);
    assert.ok(!url.startsWith("https://app.befluencer.co"));
    assert.ok(!url.includes("localhost"));
  });

  it("builds creator-list share URLs from the public origin", () => {
    clearOriginEnv();
    process.env.PUBLIC_REPORT_URL = "https://befluencer-reports.vercel.app";
    process.env.APP_URL = "https://befluencer-reports.vercel.app";

    const raw = generateRawShareToken();
    const url = buildPublicCreatorListUrl(getPublicReportOrigin(), raw);

    assert.equal(
      url,
      `https://befluencer-reports.vercel.app/lists/${raw}`
    );
    assert.ok(!url.includes("localhost"));
  });

  it("never emits localhost share URLs when Vercel production origin is available", () => {
    clearOriginEnv();
    setEnv("NODE_ENV", "production");
    setEnv("VERCEL", "1");
    process.env.APP_URL = "http://localhost:3000";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "befluencer-reports.vercel.app";

    const raw = generateRawShareToken();
    const reportUrl = buildPublicShareUrl(getPublicReportOrigin(), raw);
    const listUrl = buildPublicCreatorListUrl(getPublicReportOrigin(), raw);

    assert.equal(
      reportUrl,
      `https://befluencer-reports.vercel.app/r/${raw}`
    );
    assert.equal(
      listUrl,
      `https://befluencer-reports.vercel.app/lists/${raw}`
    );
    assert.equal(reportUrl.includes("localhost"), false);
    assert.equal(listUrl.includes("localhost"), false);
  });

  it("keeps authenticated PDF print URLs on APP_URL", () => {
    clearOriginEnv();
    process.env.APP_URL = "https://app.befluencer.co";
    process.env.PUBLIC_REPORT_URL = "https://reports.befluencer.co";

    const appOrigin = getPdfAppOrigin();
    assert.equal(appOrigin, "https://app.befluencer.co");

    const printUrl = buildPrintUrl({
      appOrigin,
      campaignId: "11111111-2222-4333-8444-555555555555",
      reportVersionId: "66666666-7777-4888-8999-aaaaaaaaaaaa",
      token: "a".repeat(64),
    });

    assert.ok(printUrl.startsWith("https://app.befluencer.co/campaigns/"));
    assert.ok(!printUrl.includes("reports.befluencer.co"));
  });

  it("documents public PDF print capability uses APP_URL (internal print)", () => {
    clearOriginEnv();
    process.env.APP_URL = "https://app.befluencer.co";
    process.env.PUBLIC_REPORT_URL = "https://reports.befluencer.co";

    const printOrigin = getAppOrigin();
    const shareOrigin = getPublicReportOrigin();

    assert.notEqual(printOrigin, shareOrigin);
    assert.equal(printOrigin, "https://app.befluencer.co");
  });

  it("does not alter token/hash behavior", () => {
    const raw = "b".repeat(64);
    assert.equal(hashShareToken(raw), hashShareToken(raw));
    assert.equal(hashShareToken(raw).length, 64);
  });
});
