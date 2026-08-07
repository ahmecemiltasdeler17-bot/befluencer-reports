import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authorMetaCreatorItem,
  authorStatsCreatorItem,
  clockworksAuthorCacheMap,
  clockworksAuthorCacheProfile,
  clockworksVideoRowForEcemdans,
  clockworksVideoRowForOtherCreator,
  compactAndGroupedCountItem,
  completeCreatorItem,
  datasetMatchingCreatorLater,
  datasetProfileAfterVideos,
  invalidIdentityItem,
  malformedFollowerCountItem,
  minimalCreatorItem,
  mismatchedCreatorItem,
  missingFollowerCountItem,
  missingIdentityItem,
  negativeCountsCreatorItem,
  notFoundCreatorItem,
  numericStringCreatorItem,
  privateCreatorErrorItem,
  privateCreatorItem,
  unsupportedCreatorShapeItem,
  videoRowMissingFollowers,
  wrappedProfilesDatasetRow,
} from "@/lib/providers/tiktok/__fixtures__/apify-creator-responses";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import {
  parseApifyTikTokCreator,
  parseApifyTikTokCreatorDataset,
  selectCreatorProfileCandidate,
} from "@/lib/providers/tiktok/parse-apify-creator";
import { parseProviderCount } from "@/lib/providers/tiktok/parse-provider-count";
import {
  assertApprovedTikTokProfile,
  buildTikTokProfileUrl,
  normalizeTikTokUsername,
  usernamesMatch,
} from "@/lib/providers/tiktok/profile-url";
import {
  itemsFromApifyAuthorCache,
  readApifyRunDatasetRef,
  unwrapApifyCreatorItems,
} from "@/lib/providers/tiktok/unwrap-apify-creator-items";

function expectProviderError(fn: () => unknown, code: string) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof TikTokProviderError);
    assert.equal(error.code, code);
    return true;
  });
}

describe("normalizeTikTokUsername", () => {
  it("accepts a bare username", () => {
    assert.equal(normalizeTikTokUsername("ecemdans"), "ecemdans");
  });

  it("strips a leading @ and surrounding whitespace", () => {
    assert.equal(normalizeTikTokUsername("  @ecemdans  "), "ecemdans");
  });

  it("extracts the handle from a profile URL", () => {
    assert.equal(
      normalizeTikTokUsername("https://www.tiktok.com/@ecemdans"),
      "ecemdans"
    );
  });

  it("rejects a video URL used as a profile input", () => {
    expectProviderError(
      () =>
        normalizeTikTokUsername(
          "https://www.tiktok.com/@ecemdans/video/7123456789012345678"
        ),
      "invalid_username"
    );
  });

  it("rejects an empty value", () => {
    expectProviderError(() => normalizeTikTokUsername("   "), "invalid_username");
  });
});

describe("buildTikTokProfileUrl", () => {
  it("builds a deterministic canonical URL", () => {
    assert.equal(
      buildTikTokProfileUrl("@ecemdans"),
      "https://www.tiktok.com/@ecemdans"
    );
  });
});

describe("assertApprovedTikTokProfile", () => {
  it("prefers the stored username over the stored profile URL", () => {
    const result = assertApprovedTikTokProfile({
      username: "ecemdans",
      profileUrl: "https://www.tiktok.com/@baskakullanici",
    });

    assert.equal(result.username, "ecemdans");
    assert.equal(result.profileUrl, "https://www.tiktok.com/@ecemdans");
  });
});

describe("usernamesMatch", () => {
  it("compares case-insensitively and ignores a leading @", () => {
    assert.equal(usernamesMatch("EcemDans", "@ecemdans"), true);
    assert.equal(usernamesMatch("ecemdans", "baskakullanici"), false);
  });
});

describe("parseProviderCount", () => {
  it("parses plain integers and numeric strings", () => {
    assert.equal(parseProviderCount(773_000), 773_000);
    assert.equal(parseProviderCount("773000"), 773_000);
  });

  it("parses comma thousands", () => {
    assert.equal(parseProviderCount("773,000"), 773_000);
    assert.equal(parseProviderCount("1,234,567"), 1_234_567);
  });

  it("parses dot thousands", () => {
    assert.equal(parseProviderCount("773.000"), 773_000);
    assert.equal(parseProviderCount("1.234.567"), 1_234_567);
  });

  it("resolves the ambiguous single-separator three-digit case as thousands", () => {
    assert.equal(parseProviderCount("1.234"), 1_234);
    assert.equal(parseProviderCount("1,234"), 1_234);
  });

  it("parses compact K/M values including Turkish decimal commas", () => {
    assert.equal(parseProviderCount("773K"), 773_000);
    assert.equal(parseProviderCount("1.2M"), 1_200_000);
    assert.equal(parseProviderCount("1,2M"), 1_200_000);
  });

  it("rejects percentages, negatives, fractions and empty values", () => {
    assert.equal(parseProviderCount("7.6%"), null);
    assert.equal(parseProviderCount(-5), null);
    assert.equal(parseProviderCount("12.34"), null);
    assert.equal(parseProviderCount(""), null);
    assert.equal(parseProviderCount(null), null);
    assert.equal(parseProviderCount(Number.NaN), null);
    assert.equal(parseProviderCount(Number.POSITIVE_INFINITY), null);
  });
});

describe("selectCreatorProfileCandidate", () => {
  it("selects a dedicated profile row over video rows", () => {
    const selected = selectCreatorProfileCandidate(
      datasetProfileAfterVideos,
      "ecemdans"
    );

    assert.equal(selected.kind, "dedicated_profile");
    assert.equal(selected.index, 1);
    assert.equal(selected.username, "ecemdans");
  });

  it("selects a matching video author when no profile row exists", () => {
    const selected = selectCreatorProfileCandidate(
      [clockworksVideoRowForEcemdans],
      "ecemdans"
    );

    assert.equal(selected.kind, "video_author");
    assert.equal(selected.username, "ecemdans");
  });

  it("skips a leading video from another creator", () => {
    const selected = selectCreatorProfileCandidate(
      datasetMatchingCreatorLater,
      "ecemdans"
    );

    assert.equal(selected.index, 1);
    assert.equal(selected.username, "ecemdans");
  });

  it("rejects when no item matches the requested username", () => {
    expectProviderError(
      () =>
        selectCreatorProfileCandidate(
          [clockworksVideoRowForOtherCreator],
          "ecemdans"
        ),
      "username_mismatch"
    );
  });
});

describe("parseApifyTikTokCreator", () => {
  it("parses a complete creator result", () => {
    const result = parseApifyTikTokCreator(completeCreatorItem, "ecemdans");

    assert.equal(result.username, "ecemdans");
    assert.equal(result.displayName, "Ecem Dans");
    assert.equal(result.profileUrl, "https://www.tiktok.com/@ecemdans");
    assert.equal(result.followerCount, 84_500);
    assert.equal(result.followingCount, 312);
    assert.equal(result.totalLikes, 1_240_000);
    assert.equal(result.videoCount, 197);
    assert.equal(result.verified, true);
  });

  it("parses numeric strings, including grouped digits", () => {
    const result = parseApifyTikTokCreator(
      numericStringCreatorItem,
      "ecemdans"
    );

    assert.equal(result.followerCount, 84_500);
    assert.equal(result.totalLikes, 1_240_000);
  });

  it("parses compact and European grouped counts", () => {
    const result = parseApifyTikTokCreator(
      compactAndGroupedCountItem,
      "ecemdans"
    );

    assert.equal(result.followerCount, 773_000);
    assert.equal(result.followingCount, 1_200);
    assert.equal(result.totalLikes, 1_200_000);
  });

  it("reads the authorMeta shape produced by video actors", () => {
    const result = parseApifyTikTokCreator(authorMetaCreatorItem, "ecemdans");

    assert.equal(result.username, "ecemdans");
    assert.equal(result.followerCount, 84_500);
    assert.equal(result.totalLikes, 1_240_000);
  });

  it("reads the author/authorStats shape", () => {
    const result = parseApifyTikTokCreator(authorStatsCreatorItem, "ecemdans");

    assert.equal(result.username, "ecemdans");
    assert.equal(result.followerCount, 84_500);
    assert.equal(result.totalLikes, 1_240_000);
  });

  it("prefers authorStats over video-level diggCount", () => {
    const result = parseApifyTikTokCreator(
      clockworksVideoRowForEcemdans,
      "ecemdans"
    );

    assert.equal(result.followerCount, 773_000);
    // diggCount on the video is 1250 — must not become total likes.
    assert.equal(result.totalLikes, 12_400_000);
    assert.equal(result.videoCount, 197);
    assert.notEqual(result.totalLikes, clockworksVideoRowForEcemdans.diggCount);
  });

  it("returns null for missing optional statistics", () => {
    const result = parseApifyTikTokCreator(minimalCreatorItem, "ecemdans");

    assert.equal(result.followerCount, 84_500);
    assert.equal(result.followingCount, null);
    assert.equal(result.totalLikes, null);
    assert.equal(result.videoCount, null);
  });

  it("rejects negative optional counts instead of clamping to zero", () => {
    const result = parseApifyTikTokCreator(
      negativeCountsCreatorItem,
      "ecemdans"
    );

    assert.equal(result.followingCount, null);
    assert.equal(result.totalLikes, null);
    assert.equal(result.videoCount, null);
  });

  it("rejects a result without a follower count instead of defaulting to zero", () => {
    expectProviderError(
      () => parseApifyTikTokCreator(missingFollowerCountItem, "ecemdans"),
      "follower_count_unavailable"
    );
  });

  it("rejects a malformed follower count string", () => {
    expectProviderError(
      () => parseApifyTikTokCreator(malformedFollowerCountItem, "ecemdans"),
      "follower_count_unavailable"
    );
  });

  it("rejects a video row without creator follower stats", () => {
    expectProviderError(
      () => parseApifyTikTokCreator(videoRowMissingFollowers, "ecemdans"),
      "follower_count_unavailable"
    );
  });

  it("exposes the distinct follower-missing Turkish message", () => {
    try {
      parseApifyTikTokCreator(missingFollowerCountItem, "ecemdans");
      assert.fail("expected throw");
    } catch (error) {
      assert.ok(error instanceof TikTokProviderError);
      assert.equal(
        error.toUserMessage(),
        "Profil bulundu ancak takipçi sayısı alınamadı."
      );
    }
  });

  it("parses the Clockworks AUTHOR_CACHE profile shape", () => {
    const result = parseApifyTikTokCreator(
      clockworksAuthorCacheProfile,
      "yarenniiom"
    );

    assert.equal(result.username, "yarenniiom");
    assert.equal(result.followerCount, 15_400);
    assert.equal(result.totalLikes, 220_000);
    assert.equal(result.videoCount, 48);
  });

  it("rejects a result without a readable handle", () => {
    expectProviderError(
      () => parseApifyTikTokCreator(missingIdentityItem, "ecemdans"),
      "malformed_result"
    );
  });

  it("rejects a handle that is not a valid TikTok username", () => {
    expectProviderError(
      () => parseApifyTikTokCreator(invalidIdentityItem),
      "malformed_result"
    );
  });

  it("maps a not-found provider result", () => {
    expectProviderError(
      () => parseApifyTikTokCreator(notFoundCreatorItem, "silinmis_hesap"),
      "creator_not_found"
    );
  });

  it("maps a private profile flag", () => {
    expectProviderError(
      () => parseApifyTikTokCreator(privateCreatorItem, "gizli_hesap"),
      "private_profile"
    );
  });

  it("maps a private profile error message", () => {
    expectProviderError(
      () => parseApifyTikTokCreator(privateCreatorErrorItem, "gizli_hesap"),
      "private_profile"
    );
  });

  it("rejects a result for a different creator than requested", () => {
    expectProviderError(
      () => parseApifyTikTokCreator(mismatchedCreatorItem, "ecemdans"),
      "username_mismatch"
    );
  });

  it("exposes the identity-mismatch Turkish message", () => {
    try {
      parseApifyTikTokCreator(mismatchedCreatorItem, "ecemdans");
      assert.fail("expected throw");
    } catch (error) {
      assert.ok(error instanceof TikTokProviderError);
      assert.equal(
        error.toUserMessage(),
        "Sağlayıcı farklı bir TikTok hesabı döndürdü. Kullanıcı adını kontrol edin."
      );
    }
  });

  it("accepts a case-different handle as the same creator", () => {
    const result = parseApifyTikTokCreator(completeCreatorItem, "EcemDans");
    assert.equal(result.username, "ecemdans");
  });
});

describe("unwrapApifyCreatorItems", () => {
  it("passes through a direct profile object", () => {
    const items = unwrapApifyCreatorItems(completeCreatorItem);
    assert.equal(items.length, 1);
    assert.equal((items[0] as { uniqueId: string }).uniqueId, "ecemdans");
  });

  it("unwraps a profiles[] wrapper row", () => {
    const items = unwrapApifyCreatorItems([wrappedProfilesDatasetRow]);
    assert.equal(items.length, 1);
    assert.equal((items[0] as { uniqueId: string }).uniqueId, "ecemdans");
  });

  it("unwraps data / items / results wrappers", () => {
    assert.equal(
      (unwrapApifyCreatorItems([{ data: [completeCreatorItem] }])[0] as { uniqueId: string })
        .uniqueId,
      "ecemdans"
    );
    assert.equal(
      (unwrapApifyCreatorItems([{ items: [completeCreatorItem] }])[0] as { uniqueId: string })
        .uniqueId,
      "ecemdans"
    );
    assert.equal(
      (
        unwrapApifyCreatorItems([{ results: [completeCreatorItem] }])[0] as {
          uniqueId: string;
        }
      ).uniqueId,
      "ecemdans"
    );
  });

  it("keeps video-author rows intact", () => {
    const items = unwrapApifyCreatorItems([clockworksVideoRowForEcemdans]);
    assert.equal(items.length, 1);
    assert.ok((items[0] as { authorMeta: unknown }).authorMeta);
  });

  it("reads AUTHOR_CACHE map values", () => {
    const items = itemsFromApifyAuthorCache(clockworksAuthorCacheMap);
    assert.equal(items.length, 1);
    assert.equal((items[0] as { name: string }).name, "yarenniiom");
  });
});

describe("readApifyRunDatasetRef", () => {
  it("reads defaultDatasetId from the current run payload", () => {
    const ref = readApifyRunDatasetRef({
      data: {
        id: "run-current",
        status: "SUCCEEDED",
        defaultDatasetId: "dataset-current",
        defaultKeyValueStoreId: "kv-current",
      },
    });

    assert.equal(ref.runId, "run-current");
    assert.equal(ref.datasetId, "dataset-current");
    assert.equal(ref.keyValueStoreId, "kv-current");
    assert.equal(ref.status, "SUCCEEDED");
  });
});

describe("parseApifyTikTokCreatorDataset", () => {
  it("rejects an empty dataset with the creator-specific empty message", () => {
    try {
      parseApifyTikTokCreatorDataset([], "ecemdans");
      assert.fail("expected throw");
    } catch (error) {
      assert.ok(error instanceof TikTokProviderError);
      assert.equal(error.code, "empty_result");
      assert.equal(
        error.toUserMessage(),
        "TikTok sağlayıcısı bu profil için boş sonuç döndürdü."
      );
    }
  });

  it("does not trust the first dataset item when it belongs to another creator", () => {
    const result = parseApifyTikTokCreatorDataset(
      datasetMatchingCreatorLater,
      "ecemdans"
    );

    assert.equal(result.username, "ecemdans");
    assert.equal(result.followerCount, 773_000);
    assert.equal(result.totalLikes, 12_400_000);
  });

  it("prefers a dedicated profile row later in the dataset", () => {
    const result = parseApifyTikTokCreatorDataset(
      datasetProfileAfterVideos,
      "ecemdans"
    );

    assert.equal(result.followerCount, 84_500);
    assert.equal(result.totalLikes, 1_240_000);
  });

  it("never uses dataset length as videoCount", () => {
    const result = parseApifyTikTokCreatorDataset(
      [
        clockworksVideoRowForEcemdans,
        { ...clockworksVideoRowForEcemdans, id: "2" },
        { ...clockworksVideoRowForEcemdans, id: "3" },
      ],
      "ecemdans"
    );

    assert.equal(result.videoCount, 197);
    assert.notEqual(result.videoCount, 3);
  });

  it("rejects when every item belongs to another creator", () => {
    expectProviderError(
      () =>
        parseApifyTikTokCreatorDataset(
          [clockworksVideoRowForOtherCreator],
          "ecemdans"
        ),
      "username_mismatch"
    );
  });

  it("parses a wrapped profiles row from a successful run packaging", () => {
    const result = parseApifyTikTokCreatorDataset(
      [wrappedProfilesDatasetRow],
      "ecemdans"
    );

    assert.equal(result.username, "ecemdans");
    assert.equal(result.followerCount, 84_500);
  });

  it("parses AUTHOR_CACHE values when the dataset was empty", () => {
    const result = parseApifyTikTokCreatorDataset(
      itemsFromApifyAuthorCache(clockworksAuthorCacheMap),
      "yarenniiom"
    );

    assert.equal(result.username, "yarenniiom");
    assert.equal(result.followerCount, 15_400);
  });

  it("does not call an unsupported non-empty row empty", () => {
    try {
      parseApifyTikTokCreatorDataset([unsupportedCreatorShapeItem], "ecemdans");
      assert.fail("expected throw");
    } catch (error) {
      assert.ok(error instanceof TikTokProviderError);
      assert.equal(error.code, "unsupported_result");
      assert.notEqual(error.code, "empty_result");
      assert.equal(
        error.toUserMessage(),
        "TikTok sağlayıcısının döndürdüğü profil biçimi desteklenmiyor."
      );
    }
  });
});
