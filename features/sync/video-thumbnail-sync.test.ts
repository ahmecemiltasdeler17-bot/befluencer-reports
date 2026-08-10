import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { resolveStoredThumbnailUrl } from "@/lib/providers/tiktok/select-video-thumbnail";

describe("video sync thumbnail preservation", () => {
  it("updates when the provider returns a valid cover", () => {
    assert.equal(
      resolveStoredThumbnailUrl(
        "https://cdn.example.com/old.jpg",
        "https://cdn.example.com/fresh.jpg"
      ),
      "https://cdn.example.com/fresh.jpg"
    );
  });

  it("preserves the existing thumbnail when the provider omits cover", () => {
    assert.equal(
      resolveStoredThumbnailUrl("https://cdn.example.com/kept.jpg", null),
      "https://cdn.example.com/kept.jpg"
    );
  });

  it("preserves the existing thumbnail when the provider returns an invalid URL", () => {
    assert.equal(
      resolveStoredThumbnailUrl(
        "https://cdn.example.com/kept.jpg",
        "not-a-url"
      ),
      "https://cdn.example.com/kept.jpg"
    );
  });

  it("replaces when the cover URL actually changes to another valid URL", () => {
    assert.equal(
      resolveStoredThumbnailUrl(
        "https://p16-sign-va.tiktokcdn.com/a.jpeg?x-expires=1",
        "https://p16-sign-va.tiktokcdn.com/b.jpeg?x-expires=2"
      ),
      "https://p16-sign-va.tiktokcdn.com/b.jpeg?x-expires=2"
    );
  });

  it("does not overwrite thumbnail_url on provider failure path", () => {
    const source = readFileSync(
      "features/sync/services/sync-tiktok-video.ts",
      "utf8"
    );
    const marker = "async function markVideoSyncFailed(";
    const start = source.indexOf(marker);
    assert.notEqual(start, -1);
    const end = source.indexOf("\nexport async function ", start + marker.length);
    assert.notEqual(end, -1);
    const helper = source.slice(start, end);

    assert.match(helper, /\.update\(\{\s*sync_status:\s*"failed"\s*\}/);
    assert.doesNotMatch(helper, /thumbnail_url/);
  });
});
