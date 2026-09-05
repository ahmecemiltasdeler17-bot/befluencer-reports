import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { leadIngestSchema, sanitizeLeadPayload } from "@/features/leads/schemas";
import { bearerMatches } from "@/features/leads/verify-ingest-secret";

/**
 * `/api/public/leads` is reachable from the open internet. These assertions
 * cover what stops it from becoming an anonymous write endpoint.
 */

const SECRET = "0123456789abcdef0123456789abcdef";

describe("bearerMatches", () => {
  it("accepts the exact secret", () => {
    assert.equal(bearerMatches(`Bearer ${SECRET}`, SECRET), true);
  });

  it("accepts a lowercase scheme and surrounding whitespace", () => {
    assert.equal(bearerMatches(`bearer  ${SECRET} `, SECRET), true);
  });

  it("rejects a missing or malformed header", () => {
    assert.equal(bearerMatches(null, SECRET), false);
    assert.equal(bearerMatches(undefined, SECRET), false);
    assert.equal(bearerMatches("", SECRET), false);
    assert.equal(bearerMatches(SECRET, SECRET), false);
    assert.equal(bearerMatches(`Basic ${SECRET}`, SECRET), false);
    assert.equal(bearerMatches("Bearer ", SECRET), false);
  });

  it("rejects a wrong secret of the same length", () => {
    const wrong = `${SECRET.slice(0, -1)}0`;
    assert.equal(wrong.length, SECRET.length);
    assert.equal(bearerMatches(`Bearer ${wrong}`, SECRET), false);
  });

  it("rejects a prefix and a suffix of the secret", () => {
    assert.equal(bearerMatches(`Bearer ${SECRET.slice(0, 8)}`, SECRET), false);
    assert.equal(bearerMatches(`Bearer ${SECRET}extra`, SECRET), false);
  });

  it("never passes when no secret is configured", () => {
    assert.equal(bearerMatches("Bearer anything", ""), false);
  });
});

describe("ingest payload boundaries", () => {
  const base = {
    kind: "creator_application" as const,
    data: {
      fullName: "Mert Can",
      email: "mert@example.com",
      tiktokUrl: "https://www.tiktok.com/@mert.can",
      bio: "Dans içerikleri üretiyorum ve markalarla çalışıyorum.",
      consent: true,
    },
  };

  it("rejects a body that is not an object", () => {
    assert.equal(leadIngestSchema.safeParse(null).success, false);
    assert.equal(leadIngestSchema.safeParse("brand_inquiry").success, false);
    assert.equal(leadIngestSchema.safeParse([base]).success, false);
  });

  it("rejects nested objects inside submitted data", () => {
    const result = leadIngestSchema.safeParse({
      ...base,
      data: { ...base.data, meta: { nested: "value" } },
    });
    assert.equal(result.success, false);
  });

  it("rejects a payload with too many fields", () => {
    const data: Record<string, string> = {
      fullName: "Mert Can",
      email: "mert@example.com",
    };
    for (let index = 0; index < 45; index += 1) {
      data[`field${index}`] = "x";
    }

    assert.equal(leadIngestSchema.safeParse({ ...base, data }).success, false);
  });

  it("never stores the honeypot value even when filled", () => {
    const payload = sanitizeLeadPayload({
      ...base.data,
      website: "http://spam.example",
    });

    assert.equal("website" in payload, false);
    assert.equal("consent" in payload, false);
  });

  it("does not let a submitted status or id reach storage as a column", () => {
    const payload = sanitizeLeadPayload({
      ...base.data,
      status: "qualified",
      id: "00000000-0000-4000-8000-000000000000",
    });

    // They survive inside the raw payload — inert JSON — but the insert only
    // reads kind, name, email, phone and the payload blob, so neither can
    // overwrite a real column.
    assert.equal(payload.status, "qualified");
    assert.equal(typeof payload.id, "string");
  });
});
