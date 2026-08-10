import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("production domain readiness contracts", () => {
  it("keeps public share routes outside protected auth layout", () => {
    const protectedLayout = read("app/(protected)/layout.tsx");
    assert.match(protectedLayout, /redirect\("\/login"\)/);

    const publicReportLayout = read("app/(public-report)/layout.tsx");
    const publicListLayout = read("app/(public-content)/layout.tsx");
    assert.equal(publicReportLayout.includes('redirect("/login")'), false);
    assert.equal(publicListLayout.includes('redirect("/login")'), false);
    assert.match(publicReportLayout, /force-dynamic/);
    assert.match(publicListLayout, /force-dynamic/);
  });

  it("proxy applies no-store and robots headers without Host-based redirects", () => {
    const proxy = read("proxy.ts");
    assert.match(proxy, /\/r\//);
    assert.match(proxy, /\/lists\//);
    assert.match(proxy, /\/api\/public\//);
    assert.match(proxy, /private, no-store/);
    assert.match(proxy, /noindex, nofollow, noarchive/);
    assert.match(proxy, /X-Content-Type-Options/);
    assert.match(proxy, /Referrer-Policy/);
    assert.equal(proxy.includes("x-forwarded-host"), false);
    assert.equal(proxy.includes('request.headers.get("host")'), false);
    assert.equal(proxy.includes("NextResponse.redirect"), false);
  });

  it("next.config sets minimal security and public share headers", () => {
    const config = read("next.config.ts");
    assert.match(config, /X-Content-Type-Options/);
    assert.match(config, /Referrer-Policy/);
    assert.match(config, /X-Frame-Options/);
    assert.match(config, /\/r\/:path\*/);
    assert.match(config, /\/lists\/:path\*/);
    assert.match(config, /private, no-store/);
    assert.equal(config.includes("Content-Security-Policy"), false);
  });

  it("report share action uses getPublicReportUrl and never Host headers", () => {
    const actions = read("features/public-reports/actions.ts");
    assert.match(actions, /getPublicReportUrl\(`\/r\/\$\{rawToken\}`\)/);
    assert.equal(actions.includes("x-forwarded-host"), false);
    assert.equal(actions.includes("window.location"), false);
  });

  it("PDF print navigation stays on APP_URL helpers", () => {
    const publicPdf = read("app/api/public/reports/[token]/pdf/route.ts");
    const authPdf = read("app/api/campaigns/[id]/reports/[versionId]/pdf/route.ts");
    assert.match(publicPdf, /getAppOrigin/);
    assert.match(authPdf, /getAppOrigin/);
    assert.match(publicPdf, /private, no-store/);
    assert.match(authPdf, /private, no-store/);
  });

  it("documents production launch without DNS automation", () => {
    const runbook = read("docs/production-domain-launch.md");
    assert.match(runbook, /app\.befluencer\.co/);
    assert.match(runbook, /reports\.befluencer\.co/);
    assert.match(runbook, /Site URL/);
    assert.match(runbook, /befluencer-reports\.vercel\.app/);
    assert.match(runbook, /Rollback/);
  });

  it("vercel.json stays cron-only (no hardcoded custom DNS)", () => {
    const vercel = read("vercel.json");
    assert.match(vercel, /tiktok-sync/);
    assert.equal(vercel.includes("befluencer.co"), false);
  });
});
