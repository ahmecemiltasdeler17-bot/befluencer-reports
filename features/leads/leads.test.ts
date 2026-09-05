import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countLeadsByStatus,
  describeLeadFields,
  extractLeadIdentity,
  extractTikTokUsername,
  isLeadKind,
  isLeadStatus,
} from "@/features/leads/calculations";
import {
  leadIngestSchema,
  parseSubmittedAt,
  sanitizeLeadPayload,
} from "@/features/leads/schemas";

describe("extractLeadIdentity", () => {
  it("reads the work email for a brand inquiry", () => {
    const identity = extractLeadIdentity("brand_inquiry", {
      fullName: "  Ayşe Yılmaz ",
      workEmail: "Ayse@Marka.CO",
      phone: " 0555 111 22 33 ",
    });

    assert.deepEqual(identity, {
      fullName: "Ayşe Yılmaz",
      email: "ayse@marka.co",
      phone: "0555 111 22 33",
    });
  });

  it("reads the personal email for a creator application", () => {
    const identity = extractLeadIdentity("creator_application", {
      fullName: "Mert Can",
      email: "mert@example.com",
    });

    assert.equal(identity.email, "mert@example.com");
    assert.equal(identity.phone, null);
  });

  it("returns empty strings instead of throwing on missing fields", () => {
    const identity = extractLeadIdentity("brand_inquiry", {});

    assert.equal(identity.fullName, "");
    assert.equal(identity.email, "");
    assert.equal(identity.phone, null);
  });
});

describe("extractTikTokUsername", () => {
  it("reads the handle from a profile URL", () => {
    assert.equal(
      extractTikTokUsername("https://www.tiktok.com/@laraalpaslan_"),
      "laraalpaslan_"
    );
  });

  it("reads the handle from a video URL", () => {
    assert.equal(
      extractTikTokUsername("https://www.tiktok.com/@mert.can/video/7412345678"),
      "mert.can"
    );
  });

  it("accepts a bare handle with or without @", () => {
    assert.equal(extractTikTokUsername("@Sudem"), "sudem");
    assert.equal(extractTikTokUsername("sudem"), "sudem");
  });

  it("returns null for a shortlink that carries no handle", () => {
    assert.equal(extractTikTokUsername("https://vm.tiktok.com/ZS2abcdef/"), null);
  });

  it("returns null for non-TikTok hosts and junk", () => {
    assert.equal(
      extractTikTokUsername("https://instagram.com/@someone"),
      null
    );
    assert.equal(extractTikTokUsername("not a url"), null);
    assert.equal(extractTikTokUsername(undefined), null);
    assert.equal(extractTikTokUsername(42), null);
  });
});

describe("sanitizeLeadPayload", () => {
  it("drops consent and honeypot fields", () => {
    const payload = sanitizeLeadPayload({
      fullName: "Ayşe",
      consent: true,
      website: "",
      message: "Merhaba",
    });

    assert.deepEqual(payload, { fullName: "Ayşe", message: "Merhaba" });
  });

  it("trims strings and drops empty ones", () => {
    const payload = sanitizeLeadPayload({
      city: "  İstanbul ",
      budget: "   ",
      phone: "",
    });

    assert.deepEqual(payload, { city: "İstanbul" });
  });

  it("keeps non-string values that are not null", () => {
    const payload = sanitizeLeadPayload({ count: 3, flagged: false, nope: null });

    assert.deepEqual(payload, { count: 3, flagged: false });
  });
});

describe("leadIngestSchema", () => {
  const brandBody = {
    kind: "brand_inquiry",
    submittedAt: "2026-09-04T10:00:00.000Z",
    data: {
      fullName: "Ayşe Yılmaz",
      company: "Marka A.Ş.",
      workEmail: "ayse@marka.co",
      campaignType: "Müzik / sound",
      targetPlatform: "TikTok",
      timing: "Ekim",
      message: "Yeni single için kampanya kurgulamak istiyoruz.",
      consent: true,
    },
  };

  it("accepts a well-formed brand inquiry", () => {
    assert.equal(leadIngestSchema.safeParse(brandBody).success, true);
  });

  it("rejects an unknown kind", () => {
    const result = leadIngestSchema.safeParse({
      ...brandBody,
      kind: "newsletter",
    });
    assert.equal(result.success, false);
  });

  it("rejects a brand inquiry without a work email", () => {
    const result = leadIngestSchema.safeParse({
      ...brandBody,
      data: { fullName: "Ayşe Yılmaz", message: "Merhaba" },
    });
    assert.equal(result.success, false);
  });

  it("rejects a creator application that only has a work email", () => {
    const result = leadIngestSchema.safeParse({
      kind: "creator_application",
      data: { fullName: "Mert Can", workEmail: "mert@marka.co" },
    });
    assert.equal(result.success, false);
  });

  it("rejects an empty payload and an oversized field", () => {
    assert.equal(
      leadIngestSchema.safeParse({ kind: "brand_inquiry", data: {} }).success,
      false
    );
    assert.equal(
      leadIngestSchema.safeParse({
        ...brandBody,
        data: { ...brandBody.data, message: "x".repeat(4_001) },
      }).success,
      false
    );
  });

  it("accepts an unknown extra field so the marketing site can evolve", () => {
    const result = leadIngestSchema.safeParse({
      ...brandBody,
      data: { ...brandBody.data, referralSource: "LinkedIn" },
    });
    assert.equal(result.success, true);
  });
});

describe("parseSubmittedAt", () => {
  it("normalizes a valid timestamp", () => {
    assert.equal(
      parseSubmittedAt("2026-09-04T10:00:00.000Z"),
      "2026-09-04T10:00:00.000Z"
    );
  });

  it("returns null when absent or unparseable", () => {
    assert.equal(parseSubmittedAt(undefined), null);
    assert.equal(parseSubmittedAt("yesterday"), null);
  });
});

describe("describeLeadFields", () => {
  it("labels known fields in order and skips the name", () => {
    const rows = describeLeadFields("creator_application", {
      fullName: "Mert Can",
      bio: "Dans içerikleri üretiyorum.",
      tiktokUrl: "https://www.tiktok.com/@mert.can",
      category: "Dans",
    });

    assert.deepEqual(
      rows.map((row) => row.key),
      ["tiktokUrl", "category", "bio"]
    );
    assert.equal(rows[0].label, "TikTok");
  });

  it("keeps unknown fields under their raw key", () => {
    const rows = describeLeadFields("brand_inquiry", {
      workEmail: "ayse@marka.co",
      referralSource: "LinkedIn",
    });

    assert.deepEqual(
      rows.map((row) => row.key),
      ["workEmail", "referralSource"]
    );
  });
});

describe("lead guards and counts", () => {
  it("recognizes valid kinds and statuses only", () => {
    assert.equal(isLeadKind("brand_inquiry"), true);
    assert.equal(isLeadKind("newsletter"), false);
    assert.equal(isLeadStatus("qualified"), true);
    assert.equal(isLeadStatus("done"), false);
  });

  it("counts every status, including zeros", () => {
    const counts = countLeadsByStatus([
      { status: "new" },
      { status: "new" },
      { status: "archived" },
    ]);

    assert.deepEqual(counts, {
      new: 2,
      contacted: 0,
      qualified: 0,
      archived: 1,
    });
  });
});
