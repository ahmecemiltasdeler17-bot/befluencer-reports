import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  alternateFieldNamesItem,
  emptyDataset,
  fallbackUrl,
  malformedMetricsItem,
  missingSavesItem,
  numericStringItem,
  privateDeletedItem,
  validCompleteItem,
} from "@/lib/providers/tiktok/__fixtures__/apify-responses";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import {
  parseApifyTikTokDataset,
  parseApifyTikTokItem,
} from "@/lib/providers/tiktok/parse-apify-item";
import {
  assertApprovedTikTokUrl,
  normalizeTikTokVideoUrl,
} from "@/lib/providers/tiktok/url";

describe("parseApifyTikTokItem", () => {
  it("parses a complete provider payload", () => {
    const result = parseApifyTikTokItem(validCompleteItem, fallbackUrl);

    assert.equal(result.platformVideoId, "7123456789012345678");
    assert.equal(result.views, 150000);
    assert.equal(result.likes, 12000);
    assert.equal(result.comments, 450);
    assert.equal(result.shares, 320);
    assert.equal(result.saves, 890);
    assert.equal(result.creatorUsername, "creator");
    assert.equal(result.creatorDisplayName, "Creator Display");
  });

  it("converts numeric strings and alternate field names", () => {
    const result = parseApifyTikTokItem(numericStringItem, fallbackUrl);

    assert.equal(result.views, 98765);
    assert.equal(result.likes, 5432);
    assert.equal(result.comments, 210);
    assert.equal(result.shares, 88);
    assert.equal(result.saves, 42);
    assert.equal(result.creatorFollowerCount, 125000);
  });

  it("recognizes alternate metric keys", () => {
    const result = parseApifyTikTokItem(alternateFieldNamesItem, fallbackUrl);

    assert.equal(result.views, 5000);
    assert.equal(result.likes, 400);
    assert.equal(result.comments, 25);
    assert.equal(result.shares, 10);
    assert.equal(result.saves, 3);
  });

  it("defaults saves to zero when unavailable", () => {
    const result = parseApifyTikTokItem(missingSavesItem, fallbackUrl);

    assert.equal(result.saves, 0);
    assert.equal(result.views, 1000);
  });

  it("throws empty_result for empty datasets", () => {
    assert.throws(
      () => parseApifyTikTokDataset(emptyDataset, fallbackUrl),
      (error: unknown) =>
        error instanceof TikTokProviderError && error.code === "empty_result"
    );
  });

  it("throws malformed_result when required metrics are missing", () => {
    assert.throws(
      () => parseApifyTikTokItem(malformedMetricsItem, fallbackUrl),
      (error: unknown) =>
        error instanceof TikTokProviderError &&
        error.code === "malformed_result"
    );
  });

  it("throws unavailable_video for private or deleted responses", () => {
    assert.throws(
      () => parseApifyTikTokItem(privateDeletedItem, fallbackUrl),
      (error: unknown) =>
        error instanceof TikTokProviderError &&
        error.code === "unavailable_video"
    );
  });
});

describe("normalizeTikTokVideoUrl", () => {
  it("accepts standard TikTok URLs and extracts video id", () => {
    const result = normalizeTikTokVideoUrl(
      "https://www.tiktok.com/@user/video/7123456789012345678?is_from_webapp=1"
    );

    assert.equal(result.platformVideoId, "7123456789012345678");
    assert.equal(
      result.normalizedUrl,
      "https://www.tiktok.com/@user/video/7123456789012345678"
    );
    assert.equal(result.isShortUrl, false);
  });

  it("preserves shortened vm.tiktok.com URLs", () => {
    const result = normalizeTikTokVideoUrl("https://vm.tiktok.com/ABC123/");

    assert.equal(result.isShortUrl, true);
    assert.equal(result.platformVideoId, null);
    assert.match(result.normalizedUrl, /^https:\/\/vm\.tiktok\.com\//);
  });

  it("rejects non-TikTok domains", () => {
    assert.throws(
      () => assertApprovedTikTokUrl("https://example.com/video/1"),
      (error: unknown) =>
        error instanceof TikTokProviderError && error.code === "invalid_url"
    );
  });
});
