import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateCreatorCategory } from "@/features/creators/calculate-creator-category";

describe("calculateCreatorCategory", () => {
  it("returns null for missing counts", () => {
    assert.equal(calculateCreatorCategory(null), null);
    assert.equal(calculateCreatorCategory(undefined), null);
  });

  it("returns null below 1,000", () => {
    assert.equal(calculateCreatorCategory(0), null);
    assert.equal(calculateCreatorCategory(999), null);
  });

  it("maps nano tier boundaries", () => {
    assert.equal(calculateCreatorCategory(1_000), "nano");
    assert.equal(calculateCreatorCategory(9_999), "nano");
  });

  it("maps micro tier boundaries", () => {
    assert.equal(calculateCreatorCategory(10_000), "micro");
    assert.equal(calculateCreatorCategory(99_999), "micro");
  });

  it("maps macro tier boundaries", () => {
    assert.equal(calculateCreatorCategory(100_000), "macro");
    assert.equal(calculateCreatorCategory(999_999), "macro");
  });

  it("maps mega tier", () => {
    assert.equal(calculateCreatorCategory(1_000_000), "mega");
    assert.equal(calculateCreatorCategory(5_500_000), "mega");
  });

  it("does not round before categorization", () => {
    assert.equal(calculateCreatorCategory(999.9), null);
    assert.equal(calculateCreatorCategory(9_999.9), "nano");
  });
});
