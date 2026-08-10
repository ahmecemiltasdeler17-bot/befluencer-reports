import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyEmptySucceededVideoRun,
  detectLoginRequiredFromDatasetItems,
  detectLoginRequiredFromLog,
} from "@/lib/providers/tiktok/detect-login-required";
import {
  LOGIN_REQUIRED_CONTENT_DETAIL,
  TikTokProviderError,
} from "@/lib/providers/tiktok/errors";

const SENSITIVE_LOG =
  "The video is with sensitive content. The scraper is not able to see posts that require login, skipping";

describe("detectLoginRequiredFromLog", () => {
  it("detects the observed Apify sensitive-content warning", () => {
    assert.equal(detectLoginRequiredFromLog(SENSITIVE_LOG), true);
  });

  it("detects common login-required phrasing", () => {
    assert.equal(
      detectLoginRequiredFromLog("Post skipped: login required to view"),
      true
    );
    assert.equal(
      detectLoginRequiredFromLog("age-restricted content blocked"),
      true
    );
  });

  it("does not treat unrelated empty/deleted wording as login-required", () => {
    assert.equal(detectLoginRequiredFromLog(""), false);
    assert.equal(detectLoginRequiredFromLog(null), false);
    assert.equal(
      detectLoginRequiredFromLog("Video not found or has been deleted"),
      false
    );
    assert.equal(
      detectLoginRequiredFromLog("Temporary upstream failure, try again"),
      false
    );
    assert.equal(
      detectLoginRequiredFromLog("Invalid URL format for postURLs"),
      false
    );
  });
});

describe("detectLoginRequiredFromDatasetItems", () => {
  it("reads skip/error markers on sparse dataset rows", () => {
    assert.equal(
      detectLoginRequiredFromDatasetItems([
        { error: SENSITIVE_LOG, skipped: true },
      ]),
      true
    );
  });

  it("does not classify a normal empty dataset as login-required", () => {
    assert.equal(detectLoginRequiredFromDatasetItems([]), false);
  });
});

describe("classifyEmptySucceededVideoRun", () => {
  it("maps successful actor + zero usable items + sensitive log to login_required_content", () => {
    assert.equal(
      classifyEmptySucceededVideoRun({
        logText: SENSITIVE_LOG,
        datasetItems: [],
      }),
      "login_required_content"
    );
  });

  it("keeps conservative empty_result fallback when log evidence is missing", () => {
    assert.equal(
      classifyEmptySucceededVideoRun({
        logText: "Scraped 0 posts",
        datasetItems: [],
      }),
      null
    );
    assert.equal(
      classifyEmptySucceededVideoRun({
        logText: null,
        datasetItems: [],
      }),
      null
    );
  });
});

describe("login_required_content error catalog", () => {
  it("exposes the Turkish primary message and detail", () => {
    const error = new TikTokProviderError("login_required_content");
    assert.equal(error.code, "login_required_content");
    assert.equal(
      error.toUserMessage(),
      "TikTok bu videoyu giriş yapılmadan görüntülemeye izin vermiyor."
    );
    assert.equal(
      LOGIN_REQUIRED_CONTENT_DETAIL,
      "Video hassas/yaş kısıtlı veya oturum gerektiren içerik olabilir."
    );
    assert.notEqual(error.code, "empty_result");
    assert.notEqual(error.code, "unavailable_video");
    assert.notEqual(error.code, "upstream_failure");
    assert.notEqual(error.code, "invalid_url");
  });
});
