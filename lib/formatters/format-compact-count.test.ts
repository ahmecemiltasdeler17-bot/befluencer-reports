import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCompactCount,
  formatExactFollowerLabel,
  formatExactTurkishCount,
  formatManagementCompactCount,
  formatReportCompactCount,
} from "@/lib/formatters/format-compact-count";
import { formatTurkishReport } from "@/lib/format";

describe("formatCompactCount", () => {
  it("formats 772900 as 772,9 B", () => {
    assert.equal(formatCompactCount(772_900), "772,9 B");
  });

  it("preserves a trailing zero when requested", () => {
    assert.equal(
      formatCompactCount(773_000, { preserveTrailingZero: true }),
      "773,0 B"
    );
    assert.equal(formatReportCompactCount(773_000), "773,0 B");
  });

  it("strips a trailing zero when not preserved", () => {
    assert.equal(
      formatCompactCount(773_000, { preserveTrailingZero: false }),
      "773 B"
    );
    assert.equal(formatManagementCompactCount(773_000), "773 B");
  });

  it("formats report-style thousands with one decimal", () => {
    assert.equal(formatReportCompactCount(143_000), "143,0 B");
    assert.equal(formatReportCompactCount(1_100), "1,1 B");
  });

  it("keeps values under 1000 as exact integers", () => {
    assert.equal(formatCompactCount(999), "999");
    assert.equal(formatCompactCount(0), "0");
    assert.equal(formatReportCompactCount(999), "999");
  });

  it("formats millions and billions", () => {
    assert.equal(formatCompactCount(1_200_000), "1,2 Mn");
    assert.equal(formatCompactCount(2_500_000_000), "2,5 Mr");
  });

  it("keeps the sign for negative growth", () => {
    assert.equal(formatCompactCount(-1_100), "-1,1 B");
    assert.equal(formatCompactCount(-772_900), "-772,9 B");
    assert.equal(formatCompactCount(-500), "-500");
  });

  it("powers the report helper used across the app", () => {
    assert.equal(formatTurkishReport(772_900), "772,9 B");
    assert.equal(formatTurkishReport(773_000), "773,0 B");
  });
});

describe("formatExactTurkishCount", () => {
  it("formats the exact Turkish integer", () => {
    assert.equal(formatExactTurkishCount(772_900), "772.900");
    assert.equal(formatExactTurkishCount(1_200_000), "1.200.000");
  });

  it("builds an accessible follower label", () => {
    assert.equal(formatExactFollowerLabel(772_900), "772.900 takipçi");
  });

  it("does not mutate numeric snapshot values while formatting", () => {
    const snapshot = { follower_count: 772_900, views: 1_200_000 };
    const before = structuredClone(snapshot);

    formatCompactCount(snapshot.follower_count);
    formatExactTurkishCount(snapshot.follower_count);
    formatReportCompactCount(snapshot.views);

    assert.deepEqual(snapshot, before);
  });
});
