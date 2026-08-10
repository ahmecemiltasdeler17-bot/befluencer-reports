import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  VIDEO_IMPORT_MESSAGES,
  VIDEO_IMPORT_VIDEO_STATUS_LABELS,
} from "@/features/video-import/constants";
import { buildPreviewRow } from "@/features/video-import/matching";
import { classifyEmptySucceededVideoRun } from "@/lib/providers/tiktok/detect-login-required";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";

const SENSITIVE_LOG =
  "The video is with sensitive content. The scraper is not able to see posts that require login, skipping";

describe("video import login_required_content", () => {
  it("builds a non-selectable preview row that preserves the pasted URL", () => {
    const originalUrl =
      "https://www.tiktok.com/@demo.creator/video/7123456789012345678";
    const row = buildPreviewRow({
      rowKey: "login:0",
      originalUrl,
      normalizedUrl: originalUrl,
      platformVideoId: "7123456789012345678",
      thumbnailUrl: null,
      caption: null,
      publishedAt: null,
      creatorUsername: null,
      creatorDisplayName: null,
      creatorAvatarUrl: null,
      creatorFollowerCount: null,
      creatorProfileUrl: null,
      views: null,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
      matchedCreator: null,
      forcedVideoStatus: "login_required_content",
      forcedMessage: VIDEO_IMPORT_MESSAGES.login_required_content,
    });

    assert.equal(row.videoStatus, "login_required_content");
    assert.equal(row.selectable, false);
    assert.equal(row.originalUrl, originalUrl);
    assert.equal(row.normalizedUrl, originalUrl);
    assert.equal(
      row.message,
      "TikTok bu videoyu giriş yapılmadan görüntülemeye izin vermiyor."
    );
    assert.equal(
      VIDEO_IMPORT_VIDEO_STATUS_LABELS.login_required_content,
      "Giriş gerekli içerik"
    );
    assert.equal(
      VIDEO_IMPORT_MESSAGES.login_required_content_detail,
      "Video hassas/yaş kısıtlı veya oturum gerektiren içerik olabilir."
    );
  });

  it("does not classify login-required as provider_empty / invalid / deleted", () => {
    const error = new TikTokProviderError("login_required_content");
    assert.notEqual(error.code, "empty_result");
    assert.notEqual(error.code, "invalid_url");
    assert.notEqual(error.code, "unavailable_video");
    assert.notEqual(error.code, "upstream_failure");
    assert.notEqual(
      VIDEO_IMPORT_VIDEO_STATUS_LABELS.login_required_content,
      VIDEO_IMPORT_VIDEO_STATUS_LABELS.provider_empty
    );
  });

  it("documents no automatic same-actor retry after login_required classification", () => {
    const providerSource = readFileSync(
      path.join(
        process.cwd(),
        "lib",
        "providers",
        "tiktok",
        "apify-provider.core.ts"
      ),
      "utf8"
    );

    assert.match(providerSource, /throwIfLoginRequiredVideoRun/);
    assert.match(providerSource, /fetchRunLogText/);
    assert.match(providerSource, /runVideoActor/);
    // Classification happens once after the finished run — no second start.
    assert.match(
      providerSource,
      /Single classification attempt after a finished run/
    );
    assert.equal(
      classifyEmptySucceededVideoRun({
        logText: SENSITIVE_LOG,
        datasetItems: [],
      }),
      "login_required_content"
    );
  });

  it("preview batch mapping continues when one row is login-required", () => {
    const source = readFileSync(
      path.join(process.cwd(), "features", "video-import", "actions.ts"),
      "utf8"
    );

    assert.match(source, /mapWithConcurrency/);
    assert.match(source, /login_required_content/);
    assert.match(source, /Preserve the pasted URL/);
    // Batched preview still fans per-URL errors without aborting siblings.
    assert.match(source, /fetchVideoMetricsBatch|scrapeResults/);
    assert.match(source, /errorCode: error\.code/);
  });

  it("UI surfaces Turkish primary + secondary copy for login-required rows", () => {
    const dialog = readFileSync(
      path.join(
        process.cwd(),
        "features",
        "video-import",
        "components",
        "import-campaign-videos-dialog.tsx"
      ),
      "utf8"
    );

    assert.match(dialog, /login_required_content/);
    assert.match(dialog, /login_required_content_detail/);
    assert.match(dialog, /row\.originalUrl/);
  });
});
