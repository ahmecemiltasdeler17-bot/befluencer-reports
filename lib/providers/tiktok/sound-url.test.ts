import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import {
  isTikTokSoundUrl,
  normalizeTikTokSoundUrl,
  parseTikTokSoundId,
} from "@/lib/providers/tiktok/sound-url";

describe("normalizeTikTokSoundUrl", () => {
  it("accepts a valid music URL and parses the sound id", () => {
    const result = normalizeTikTokSoundUrl(
      "https://www.tiktok.com/music/a-negroni-sbagliato-w-prosecco-l-hbo-max-7149523537730997035?utm_source=share"
    );

    assert.equal(
      result.normalizedUrl,
      "https://www.tiktok.com/music/a-negroni-sbagliato-w-prosecco-l-hbo-max-7149523537730997035"
    );
    assert.equal(result.soundId, "7149523537730997035");
    assert.equal(result.isShortUrl, false);
  });

  it("accepts a supported short URL", () => {
    const result = normalizeTikTokSoundUrl("https://vm.tiktok.com/ZMabcdef/");
    assert.equal(result.isShortUrl, true);
    assert.ok(result.normalizedUrl.includes("vm.tiktok.com"));
  });

  it("rejects a video URL", () => {
    assert.throws(
      () =>
        normalizeTikTokSoundUrl(
          "https://www.tiktok.com/@user/video/7123456789012345678"
        ),
      (error: unknown) =>
        error instanceof TikTokProviderError &&
        error.code === "unsupported_sound_url"
    );
  });

  it("rejects a profile URL", () => {
    assert.throws(
      () => normalizeTikTokSoundUrl("https://www.tiktok.com/@someone"),
      (error: unknown) =>
        error instanceof TikTokProviderError &&
        error.code === "unsupported_sound_url"
    );
  });

  it("rejects an arbitrary host", () => {
    assert.throws(
      () => normalizeTikTokSoundUrl("https://example.com/music/foo-1234567890"),
      (error: unknown) =>
        error instanceof TikTokProviderError && error.code === "invalid_sound_url"
    );
  });

  it("rejects unsafe schemes", () => {
    assert.throws(
      () => normalizeTikTokSoundUrl("javascript:alert(1)"),
      TikTokProviderError
    );
    assert.throws(
      () => normalizeTikTokSoundUrl("//www.tiktok.com/music/foo-1234567890"),
      TikTokProviderError
    );
  });
});

describe("parseTikTokSoundId / isTikTokSoundUrl", () => {
  it("parses a sound id from a music slug", () => {
    assert.equal(
      parseTikTokSoundId(
        "https://www.tiktok.com/music/Oh-No-Instrumental-6889520563052645121"
      ),
      "6889520563052645121"
    );
  });

  it("detects valid and invalid sound URLs", () => {
    assert.equal(
      isTikTokSoundUrl(
        "https://www.tiktok.com/music/Oh-No-Instrumental-6889520563052645121"
      ),
      true
    );
    assert.equal(
      isTikTokSoundUrl("https://www.tiktok.com/@user/video/1234567890123456789"),
      false
    );
  });
});
