import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("tiktok env contracts (source-level, no secrets)", () => {
  it("keeps Apify env validation separate from platform origin helpers", () => {
    const source = readFileSync("lib/env.server.ts", "utf8");
    assert.match(source, /APIFY_API_TOKEN/);
    assert.match(source, /APIFY_TIKTOK_ACTOR_ID/);
    assert.match(source, /function isTikTokSyncConfigured/);
    assert.match(source, /function isTikTokCreatorSyncConfigured/);
    // Domain/origin helpers must not be required to validate Apify sync env.
    assert.equal(source.includes("getPublicReportOrigin"), false);
    assert.equal(source.includes("runDomainReadinessChecks"), false);
    assert.equal(source.includes("console.log(process.env.APIFY"), false);
  });

  it("creator sync still gates on isTikTokSyncConfigured before provider create", () => {
    const sync = readFileSync(
      "features/creator-sync/services/sync-tiktok-creator.ts",
      "utf8"
    );
    assert.match(sync, /isTikTokSyncConfigured/);
    assert.match(sync, /createApifyTikTokProvider/);
    assert.match(sync, /not_configured/);
  });
});
