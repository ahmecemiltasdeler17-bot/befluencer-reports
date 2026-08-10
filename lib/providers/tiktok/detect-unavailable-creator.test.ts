import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectUnavailableCreatorItem,
  isDefinitiveUnavailableCreatorError,
  unavailableReasonFromProviderError,
} from "@/lib/providers/tiktok/detect-unavailable-creator";
import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import { parseApifyTikTokCreatorDataset } from "@/lib/providers/tiktok/parse-apify-creator";
import { evaluateCreatorSyncEligibility } from "@/lib/providers/tiktok/sync-eligibility";

describe("detectUnavailableCreatorItem", () => {
  it("classifies definitive not-found evidence", () => {
    const hit = detectUnavailableCreatorItem({
      error: "User not found",
    });
    assert.equal(hit?.code, "creator_not_found");
    assert.equal(hit?.reason, "not_found");
  });

  it("classifies banned / deleted / suspended", () => {
    assert.equal(
      detectUnavailableCreatorItem({ message: "This account was banned" })
        ?.reason,
      "banned"
    );
    assert.equal(
      detectUnavailableCreatorItem({ error: "Account deleted" })?.reason,
      "deleted"
    );
    assert.equal(
      detectUnavailableCreatorItem({ status: "suspended" })?.reason,
      "suspended"
    );
  });

  it("does not classify unrecognized error text as unavailable", () => {
    assert.equal(
      detectUnavailableCreatorItem({
        error: "temporary upstream glitch XYZ",
      }),
      null
    );
  });

  it("does not treat empty dataset alone as unavailable", () => {
    assert.throws(
      () => parseApifyTikTokCreatorDataset([], "someuser"),
      (error: unknown) =>
        error instanceof TikTokProviderError && error.code === "empty_result"
    );
    assert.equal(isDefinitiveUnavailableCreatorError(
      new TikTokProviderError("empty_result")
    ), false);
  });
});

describe("unavailable sync eligibility", () => {
  it("skips unavailable accounts before Apify unless force", () => {
    const skipped = evaluateCreatorSyncEligibility({
      accountStatus: "unavailable",
      lastSyncedAt: null,
      syncStatus: "failed",
    });
    assert.equal(skipped.eligible, false);
    assert.equal(skipped.reason, "unavailable_account");

    const forced = evaluateCreatorSyncEligibility({
      accountStatus: "unavailable",
      force: true,
    });
    assert.equal(forced.eligible, true);
    assert.equal(forced.reason, "force");
  });

  it("excludes unavailable creators from automatic batch planning keys", () => {
    const creators = [
      { username: "alive", accountStatus: "active" as const },
      { username: "gone", accountStatus: "unavailable" as const },
      { username: "also", accountStatus: "active" as const },
    ];

    const batchKeys = creators
      .filter((creator) => {
        const decision = evaluateCreatorSyncEligibility({
          accountStatus: creator.accountStatus,
          lastSyncedAt: null,
        });
        return decision.eligible;
      })
      .map((creator) => creator.username);

    assert.deepEqual(batchKeys, ["alive", "also"]);
  });

  it("maps provider error codes to unavailable reasons", () => {
    assert.equal(
      unavailableReasonFromProviderError(
        new TikTokProviderError("creator_not_found", undefined, "deleted")
      ),
      "deleted"
    );
    assert.equal(
      unavailableReasonFromProviderError(
        new TikTokProviderError("private_profile")
      ),
      "private"
    );
  });
});
