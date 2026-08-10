import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  bumpNonRetriableSkip,
  createEmptyVideoSkipBreakdown,
  formatSyncMetricsTurkish,
  formatVideoSkipBreakdownTurkish,
} from "@/lib/providers/tiktok/sync-observability";
import { NON_RETRIABLE_PROVIDER_CODES } from "@/lib/providers/tiktok/sync-policy";
import { inferProviderErrorCodeFromUserMessage } from "@/lib/providers/tiktok/errors";
import { evaluateVideoSyncEligibility } from "@/lib/providers/tiktok/sync-eligibility";
import { AdminVideoThumbnail } from "@/features/videos/components/admin-video-thumbnail";
import { readFileSync } from "node:fs";

describe("bulk plan does not freeze transient failures", () => {
  it("treats upstream_failure / timeout / empty as retryable", () => {
    for (const message of [
      "TikTok veri sağlayıcı geçici olarak kullanılamıyor.",
      "TikTok veri sağlayıcı isteği zaman aşımına uğradı.",
      "TikTok veri sağlayıcı sonuç döndürmedi.",
    ]) {
      const code = inferProviderErrorCodeFromUserMessage(message);
      assert.equal(
        (NON_RETRIABLE_PROVIDER_CODES as Set<string>).has(code ?? ""),
        false,
        message
      );
      const decision = evaluateVideoSyncEligibility({
        lastSyncedAt: null,
        syncStatus: "failed",
        campaignStatus: "active",
        lastErrorCode: code,
      });
      assert.equal(decision.eligible, true, message);
    }
  });

  it("does not mark every failed video non-retryable", () => {
    const codes = [
      inferProviderErrorCodeFromUserMessage(
        "TikTok veri sağlayıcı geçici olarak kullanılamıyor."
      ),
      inferProviderErrorCodeFromUserMessage(
        "Video kullanılamıyor, gizli veya silinmiş olabilir."
      ),
      inferProviderErrorCodeFromUserMessage(
        "TikTok bu videoyu giriş yapılmadan görüntülemeye izin vermiyor."
      ),
      null,
    ];

    const nonRetryable = codes.filter(
      (code) =>
        code && (NON_RETRIABLE_PROVIDER_CODES as Set<string>).has(code)
    );
    assert.equal(nonRetryable.length, 2);
    assert.equal(codes.includes("upstream_failure"), true);
  });
});

describe("plan reason breakdown", () => {
  it("formats non-retryable reason breakdown in Turkish", () => {
    const breakdown = createEmptyVideoSkipBreakdown();
    bumpNonRetriableSkip(breakdown, "login_required_content");
    bumpNonRetriableSkip(breakdown, "login_required_content");
    bumpNonRetriableSkip(breakdown, "unavailable_video");
    bumpNonRetriableSkip(breakdown, "invalid_url");

    const text = formatVideoSkipBreakdownTurkish(breakdown);
    assert.match(text ?? "", /4 senkronize edilmeyecek/);
    assert.match(text ?? "", /2 giriş gerektiren içerik/);
    assert.match(text ?? "", /1 gizli\/silinmiş/);
    assert.match(text ?? "", /1 geçersiz URL/);

    const summary = formatSyncMetricsTurkish(
      {
        providerRunsStarted: 0,
        entitiesRequested: 0,
        entitiesReturned: 0,
        skippedFresh: 0,
        skippedNonRetriable: 4,
        skippedCooldown: 0,
        skippedUnavailable: 0,
        failed: 0,
        success: 0,
        durationMs: 1,
        estimatedRunsSaved: 0,
      },
      breakdown
    );
    assert.match(summary, /senkronize edilmeyecek/);
    assert.equal(summary.includes("4 yeniden denenmeyecek"), false);
  });
});

describe("admin video thumbnail fallback", () => {
  it("renders branded fallback when thumbnail URL is null", () => {
    const html = renderToStaticMarkup(
      <AdminVideoThumbnail
        src={null}
        seed="vid-1"
        username="creator"
        platform="tiktok"
      />
    );
    assert.match(html, /data-admin-video-thumbnail="fallback"/);
    assert.match(html, /Görsel alınamadı/);
    assert.match(html, /@creator/);
    assert.match(html, /BF/);
    assert.equal(html.includes("<img"), false);
  });

  it("renders img when URL is present (client onError handles failure)", () => {
    const html = renderToStaticMarkup(
      <AdminVideoThumbnail
        src="https://cdn.example.com/thumb.jpg"
        seed="vid-2"
        username="creator"
      />
    );
    assert.match(html, /data-admin-video-thumbnail="image"/);
    assert.match(html, /src="https:\/\/cdn\.example\.com\/thumb\.jpg"/);
    assert.match(
      readFileSync("features/videos/components/admin-video-thumbnail.tsx", "utf8"),
      /onError/
    );
  });

  it("campaign list uses AdminVideoThumbnail", () => {
    const source = readFileSync(
      "features/videos/components/campaign-video-list.tsx",
      "utf8"
    );
    assert.match(source, /AdminVideoThumbnail/);
    assert.equal(source.includes('src={video.thumbnail_url}'), true);
  });
});

describe("campaign sync action soft-rechecks login_required", () => {
  it("passes recheckLoginRequired without force:true", () => {
    const actions = readFileSync("features/sync/actions.ts", "utf8");
    assert.match(actions, /recheckLoginRequired:\s*true/);
    assert.doesNotMatch(actions, /force:\s*true/);
  });
});
