import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  avatarAndMusicOnlyItem,
  clockworksVideoMetaItem,
  dynamicCoverOnlyItem,
  unsafeThumbnailSchemesItem,
  validCompleteItem,
} from "@/lib/providers/tiktok/__fixtures__/apify-responses";
import { parseApifyTikTokItem } from "@/lib/providers/tiktok/parse-apify-item";
import {
  isValidThumbnailUrl,
  resolveStoredThumbnailUrl,
  selectVideoThumbnail,
} from "@/lib/providers/tiktok/select-video-thumbnail";

const FALLBACK_URL =
  "https://www.tiktok.com/@creator/video/7123456789012345678";

describe("isValidThumbnailUrl", () => {
  it("accepts absolute http(s) URLs with CDN query strings", () => {
    assert.equal(
      isValidThumbnailUrl(
        "https://p16-sign-va.tiktokcdn.com/obj/cover.jpeg?x-expires=1&x-signature=abc"
      ),
      true
    );
  });

  it("rejects unsafe schemes and relative paths", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:image/png;base64,aaaa",
      "blob:https://example.com/uuid",
      "file:///tmp/a.jpg",
      "/relative/path.jpg",
      "",
      null,
      undefined,
    ]) {
      assert.equal(isValidThumbnailUrl(value), false, String(value));
    }
  });
});

describe("selectVideoThumbnail", () => {
  it("prefers original/static cover over large, standard, and dynamic", () => {
    const selected = selectVideoThumbnail(clockworksVideoMetaItem);

    assert.equal(selected.field, "videoMeta.originalCover");
    assert.ok(selected.url?.includes("original.jpeg"));
    assert.equal(selected.validated, true);
  });

  it("falls back to standard cover when original/large are absent", () => {
    const selected = selectVideoThumbnail({
      cover: "https://cdn.example.com/cover.jpg",
      dynamicCover: "https://cdn.example.com/dynamic.webp",
    });

    assert.equal(selected.field, "cover");
    assert.equal(selected.url, "https://cdn.example.com/cover.jpg");
  });

  it("uses dynamic cover only as the last real-media option", () => {
    const selected = selectVideoThumbnail(dynamicCoverOnlyItem);

    assert.equal(selected.field, "dynamicCover");
    assert.equal(
      selected.url,
      "https://p16-sign-va.tiktokcdn.com/obj/dynamic-only.webp"
    );
  });

  it("ignores avatar URLs even when assigned to cover", () => {
    const selected = selectVideoThumbnail(avatarAndMusicOnlyItem);

    assert.equal(selected.url, null);
    assert.equal(selected.field, null);
  });

  it("ignores music cover URLs", () => {
    const selected = selectVideoThumbnail({
      musicMeta: { coverLarge: "https://cdn.example.com/music.jpg" },
      cover: "https://cdn.example.com/music.jpg",
    });

    assert.equal(selected.url, null);
  });

  it("rejects malformed and unsafe candidate URLs", () => {
    const selected = selectVideoThumbnail(unsafeThumbnailSchemesItem);

    assert.equal(selected.url, null);
    assert.equal(selected.validated, false);
  });

  it("returns null when no cover fields exist", () => {
    const selected = selectVideoThumbnail({
      id: "1",
      playCount: 1,
      diggCount: 1,
      commentCount: 1,
      shareCount: 1,
    });

    assert.equal(selected.url, null);
  });

  it("parses a Clockworks videoMeta fixture through the item parser", () => {
    const result = parseApifyTikTokItem(clockworksVideoMetaItem, FALLBACK_URL);

    assert.ok(result.thumbnailUrl?.includes("original.jpeg"));
    assert.match(result.thumbnailUrl ?? "", /x-signature=abc/);
  });

  it("parses the baseline complete item cover", () => {
    const result = parseApifyTikTokItem(validCompleteItem, FALLBACK_URL);

    assert.equal(result.thumbnailUrl, "https://cdn.example.com/cover.jpg");
  });
});

describe("resolveStoredThumbnailUrl", () => {
  const oldUrl = "https://cdn.example.com/old-cover.jpg";
  const newUrl = "https://cdn.example.com/new-cover.jpg";

  it("stores a valid new thumbnail", () => {
    assert.equal(resolveStoredThumbnailUrl(null, newUrl), newUrl);
  });

  it("preserves the old value when the provider returns null", () => {
    assert.equal(resolveStoredThumbnailUrl(oldUrl, null), oldUrl);
  });

  it("preserves the old value when the provider returns an invalid URL", () => {
    assert.equal(
      resolveStoredThumbnailUrl(oldUrl, "javascript:alert(1)"),
      oldUrl
    );
    assert.equal(resolveStoredThumbnailUrl(oldUrl, "/relative.jpg"), oldUrl);
  });

  it("replaces the old value when a genuinely new valid URL arrives", () => {
    assert.equal(resolveStoredThumbnailUrl(oldUrl, newUrl), newUrl);
  });

  it("keeps null when both sides are empty or invalid", () => {
    assert.equal(resolveStoredThumbnailUrl(null, null), null);
    assert.equal(resolveStoredThumbnailUrl("", "blob:x"), null);
  });
});
