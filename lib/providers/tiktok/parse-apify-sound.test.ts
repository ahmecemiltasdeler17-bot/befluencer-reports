import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dedicatedSoundObject,
  OTHER_SOUND_ID,
  SOUND_ID,
  videoRowGroupedUsage,
  videoRowMalformedUsage,
  videoRowMissingUsage,
  videoRowWithMusicMeta,
  videoRowWrongSound,
} from "@/lib/providers/tiktok/__fixtures__/apify-sound-responses";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import {
  parseApifyTikTokSoundDataset,
  selectSoundProfileCandidate,
} from "@/lib/providers/tiktok/parse-apify-sound";

const REQUESTED_URL = `https://www.tiktok.com/music/a-negroni-sbagliato-w-prosecco-l-hbo-max-${SOUND_ID}`;

describe("selectSoundProfileCandidate", () => {
  it("prefers a dedicated sound object with an exact id match", () => {
    const { candidate } = selectSoundProfileCandidate(
      [videoRowWrongSound(), dedicatedSoundObject()],
      SOUND_ID
    );

    assert.equal(candidate?.type, "dedicated_sound");
    assert.equal(candidate?.usageCount, 80_300);
  });

  it("selects a later matching video musicMeta row", () => {
    const { candidate } = selectSoundProfileCandidate(
      [videoRowWrongSound(), videoRowWithMusicMeta()],
      SOUND_ID
    );

    assert.equal(candidate?.type, "video_music_meta");
    assert.equal(candidate?.soundId, SOUND_ID);
    assert.equal(candidate?.usageCount, 80_300);
  });

  it("rejects when only a mismatched sound id is present", () => {
    const { candidate, diagnostics } = selectSoundProfileCandidate(
      [videoRowWrongSound()],
      SOUND_ID
    );

    assert.equal(candidate, null);
    assert.equal(diagnostics.errorCode, "sound_identity_mismatch");
  });
});

describe("parseApifyTikTokSoundDataset", () => {
  it("parses a dedicated sound object", () => {
    const profile = parseApifyTikTokSoundDataset([dedicatedSoundObject()], {
      soundUrl: REQUESTED_URL,
      soundId: SOUND_ID,
    });

    assert.equal(profile.usageCount, 80_300);
    assert.equal(profile.soundId, SOUND_ID);
    assert.equal(profile.title, "a negroni sbagliato w prosecco l hbo max");
  });

  it("parses compact K usage from searchMusic.videos", () => {
    const profile = parseApifyTikTokSoundDataset([videoRowWithMusicMeta()], {
      soundUrl: REQUESTED_URL,
      soundId: SOUND_ID,
    });

    assert.equal(profile.usageCount, 80_300);
  });

  it("parses grouped usage counts", () => {
    const profile = parseApifyTikTokSoundDataset([videoRowGroupedUsage()], {
      soundUrl: REQUESTED_URL,
      soundId: SOUND_ID,
    });

    assert.equal(profile.usageCount, 80_300);
  });

  it("ignores top-level video playCount and dataset length", () => {
    const profile = parseApifyTikTokSoundDataset(
      [
        videoRowWithMusicMeta({ usage: "1.2K", playCount: 99_999_999 }),
        videoRowWithMusicMeta({ usage: "1.2K" }),
        videoRowWithMusicMeta({ usage: "1.2K" }),
      ],
      { soundUrl: REQUESTED_URL, soundId: SOUND_ID }
    );

    assert.equal(profile.usageCount, 1_200);
    assert.notEqual(profile.usageCount, 3);
    assert.notEqual(profile.usageCount, 99_999_999);
  });

  it("fails when usage is missing", () => {
    assert.throws(
      () =>
        parseApifyTikTokSoundDataset([videoRowMissingUsage()], {
          soundUrl: REQUESTED_URL,
          soundId: SOUND_ID,
        }),
      (error: unknown) =>
        error instanceof TikTokProviderError &&
        error.code === "sound_usage_unavailable"
    );
  });

  it("fails when usage is malformed", () => {
    assert.throws(
      () =>
        parseApifyTikTokSoundDataset([videoRowMalformedUsage()], {
          soundUrl: REQUESTED_URL,
          soundId: SOUND_ID,
        }),
      (error: unknown) =>
        error instanceof TikTokProviderError &&
        error.code === "sound_usage_unavailable"
    );
  });

  it("fails on sound identity mismatch", () => {
    assert.throws(
      () =>
        parseApifyTikTokSoundDataset([videoRowWrongSound()], {
          soundUrl: REQUESTED_URL,
          soundId: SOUND_ID,
        }),
      (error: unknown) =>
        error instanceof TikTokProviderError &&
        error.code === "sound_identity_mismatch"
    );
  });

  it("allows optional title/author/cover to be missing", () => {
    const profile = parseApifyTikTokSoundDataset(
      [
        dedicatedSoundObject({
          title: undefined,
          musicName: undefined,
          authorName: undefined,
          musicAuthor: undefined,
          coverUrl: undefined,
        }),
      ],
      { soundUrl: REQUESTED_URL, soundId: SOUND_ID }
    );

    assert.equal(profile.usageCount, 80_300);
    assert.equal(profile.title, null);
    assert.equal(profile.authorName, null);
    assert.equal(profile.coverUrl, null);
  });

  it("fails on an empty dataset", () => {
    assert.throws(
      () =>
        parseApifyTikTokSoundDataset([], {
          soundUrl: REQUESTED_URL,
          soundId: SOUND_ID,
        }),
      (error: unknown) =>
        error instanceof TikTokProviderError && error.code === "empty_result"
    );
  });

  it("does not trust dataset[0] when a later row matches", () => {
    const profile = parseApifyTikTokSoundDataset(
      [
        videoRowWithMusicMeta({ musicId: OTHER_SOUND_ID, usage: "9K" }),
        videoRowWithMusicMeta({ musicId: SOUND_ID, usage: "80.3K" }),
      ],
      { soundUrl: REQUESTED_URL, soundId: SOUND_ID }
    );

    assert.equal(profile.usageCount, 80_300);
    assert.equal(profile.soundId, SOUND_ID);
  });
});
