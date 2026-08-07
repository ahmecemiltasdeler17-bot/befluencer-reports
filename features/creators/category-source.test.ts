import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { calculateCreatorCategory } from "@/features/creators/calculate-creator-category";

describe("automatic category reset action", () => {
  it("recalculates from the current follower count", () => {
    assert.equal(calculateCreatorCategory(12_500), "micro");
    assert.equal(calculateCreatorCategory(800), null);
  });

  it("sets category_source to auto without calling the provider", () => {
    const source = readFileSync("features/creators/actions.ts", "utf8");
    assert.match(source, /resetCreatorCategoryToAutoAction/);
    assert.match(source, /category_source:\s*"auto"/);
    assert.match(source, /calculateCreatorCategory\(creator\.follower_count\)/);
    assert.doesNotMatch(
      source.slice(source.indexOf("resetCreatorCategoryToAutoAction")),
      /syncTikTokCreator|createApifyTikTokProvider|fetchCreatorProfile/
    );
  });
});
