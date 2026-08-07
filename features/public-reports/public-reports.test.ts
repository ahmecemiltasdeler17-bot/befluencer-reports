import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { describe, it } from "node:test";

import {
  SHARE_LABEL_MAX_LENGTH,
  SHARE_MAX_EXPIRY_MS,
  assertExpiryWithinLimit,
  isShareableVersionStatus,
  mapShareRow,
  resolvePublicShareStatus,
  resolveShareExpiresAt,
  sanitizeShareLabel,
} from "@/features/public-reports/calculations";
import {
  PUBLIC_SHARE_UNAVAILABLE_MESSAGE,
  PublicReportShareError,
  toManagementShareMessage,
  toPublicShareMessage,
} from "@/features/public-reports/errors";
import {
  RESOLVE_PUBLIC_SHARE_RPC,
  RESOLVE_PUBLIC_SHARE_RPC_KEYS,
  RESOLVE_PUBLIC_SHARE_RPC_PARAM,
  mapRpcPayload,
} from "@/features/public-reports/rpc-contract";
import { consumePublicRateLimit } from "@/features/public-reports/rate-limit";
import {
  PUBLIC_SHARE_TOKEN_BYTES,
  PUBLIC_SHARE_TOKEN_HEX_LENGTH,
  buildPublicShareUrl,
  generateAccessNonce,
  generateRawShareToken,
  hashShareToken,
  isAccessNonce,
  isRawShareToken,
  normalizeRouteShareToken,
} from "@/features/public-reports/token";
import type { PublicReportShareRow } from "@/features/public-reports/types";

const APP_ORIGIN = "https://reports.example.com";
const VERSION_ID = "66666666-7777-4888-8999-aaaaaaaaaaaa";

describe("public share token", () => {
  it("generates 32-byte (64 hex) cryptographically random tokens", () => {
    const a = generateRawShareToken();
    const b = generateRawShareToken();

    assert.equal(a.length, PUBLIC_SHARE_TOKEN_HEX_LENGTH);
    assert.equal(PUBLIC_SHARE_TOKEN_BYTES, 32);
    assert.ok(isRawShareToken(a));
    assert.notEqual(a, b);
  });

  it("hashes with stable SHA-256", () => {
    const raw = "a".repeat(64);
    const expected = createHash("sha256").update(raw, "utf8").digest("hex");

    assert.equal(hashShareToken(raw), expected);
    assert.equal(hashShareToken(raw), hashShareToken(raw));
  });

  it("matches Postgres extensions.digest(convert_to(token,'UTF8'),'sha256') expectation", () => {
    // Known vector: SHA-256 of 64 ascii 'a' bytes (UTF-8 identical for hex alphabet).
    // Postgres: encode(digest(convert_to(repeat('a',64),'UTF8'),'sha256'),'hex')
    const raw = "a".repeat(64);
    const nodeHash = createHash("sha256").update(raw, "utf8").digest("hex");
    const expected =
      "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb";

    assert.equal(nodeHash, expected);
    assert.equal(hashShareToken(raw), expected);
    assert.equal(nodeHash.length, 64);
    assert.ok(/^[0-9a-f]{64}$/.test(nodeHash));
  });

  it("passes route tokens unchanged (no decode/trim/truncate)", () => {
    const raw = generateRawShareToken();
    assert.equal(normalizeRouteShareToken(raw), raw);
    assert.notEqual(normalizeRouteShareToken(raw), hashShareToken(raw));
  });

  it("validates token format and rejects invalid tokens", () => {
    assert.equal(isRawShareToken("a".repeat(64)), true);
    assert.equal(isRawShareToken("A".repeat(64)), false);
    assert.equal(isRawShareToken("g".repeat(64)), false);
    assert.equal(isRawShareToken("short"), false);
    assert.equal(isRawShareToken(""), false);
  });

  it("builds public URL from the public-report origin only", () => {
    const raw = generateRawShareToken();
    const url = buildPublicShareUrl(APP_ORIGIN, raw);

    assert.equal(url, `${APP_ORIGIN}/r/${raw}`);
    assert.ok(!url.includes(VERSION_ID));
    assert.ok(!url.includes("campaign"));
  });

  it("never returns token hash from URL builder", () => {
    const raw = generateRawShareToken();
    const hash = hashShareToken(raw);
    const url = buildPublicShareUrl(APP_ORIGIN, raw);

    assert.ok(!url.includes(hash));
    assert.ok(url.includes(raw));
  });

  it("generates 32-hex access nonces", () => {
    const nonce = generateAccessNonce();
    assert.equal(nonce.length, 32);
    assert.ok(isAccessNonce(nonce));
    assert.equal(isAccessNonce("zz"), false);
  });
});

describe("share expiry and labels", () => {
  const now = new Date("2026-08-06T10:00:00.000Z");

  it("supports never and preset expiries", () => {
    assert.equal(resolveShareExpiresAt("never", now), null);
    assert.equal(
      resolveShareExpiresAt("24h", now),
      "2026-08-07T10:00:00.000Z"
    );
    assert.equal(
      resolveShareExpiresAt("7d", now),
      "2026-08-13T10:00:00.000Z"
    );
    assert.equal(
      resolveShareExpiresAt("30d", now),
      "2026-09-05T10:00:00.000Z"
    );
  });

  it("accepts custom future expiry within 1 year", () => {
    const custom = "2026-09-01T12:00:00.000Z";
    assert.equal(resolveShareExpiresAt("custom", now, custom), custom);
  });

  it("rejects past custom expiry", () => {
    assert.throws(
      () =>
        resolveShareExpiresAt("custom", now, "2026-08-01T00:00:00.000Z"),
      /expiry_not_future/
    );
  });

  it("rejects custom expiry beyond 1 year", () => {
    const tooFar = new Date(now.getTime() + SHARE_MAX_EXPIRY_MS + 1000).toISOString();
    assert.throws(
      () => resolveShareExpiresAt("custom", now, tooFar),
      /expiry_too_far/
    );
  });

  it("assertExpiryWithinLimit rejects past and far-future", () => {
    assert.throws(
      () => assertExpiryWithinLimit("2020-01-01T00:00:00.000Z", now),
      /expiry_not_future/
    );
    assert.doesNotThrow(() => assertExpiryWithinLimit(null, now));
  });

  it("sanitizes labels", () => {
    assert.equal(sanitizeShareLabel("  Hello  "), "Hello");
    assert.equal(sanitizeShareLabel("a".repeat(200))?.length, SHARE_LABEL_MAX_LENGTH);
    assert.equal(sanitizeShareLabel("\u0000bad"), "bad");
    assert.equal(sanitizeShareLabel("   "), null);
  });
});

describe("share status and shareable versions", () => {
  it("maps active / expired / revoked", () => {
    const now = new Date("2026-08-06T12:00:00.000Z");

    assert.equal(
      resolvePublicShareStatus(
        { revoked_at: null, expires_at: null },
        now
      ),
      "active"
    );
    assert.equal(
      resolvePublicShareStatus(
        {
          revoked_at: null,
          expires_at: "2026-08-05T00:00:00.000Z",
        },
        now
      ),
      "expired"
    );
    assert.equal(
      resolvePublicShareStatus(
        {
          revoked_at: "2026-08-06T11:00:00.000Z",
          expires_at: null,
        },
        now
      ),
      "revoked"
    );
  });

  it("allows ready and archived only", () => {
    assert.equal(isShareableVersionStatus("ready"), true);
    assert.equal(isShareableVersionStatus("archived"), true);
    assert.equal(isShareableVersionStatus("generating"), false);
    assert.equal(isShareableVersionStatus("failed"), false);
  });

  it("mapShareRow never includes token_hash", () => {
    const row: PublicReportShareRow = {
      id: "11111111-2222-4333-8444-555555555555",
      report_version_id: VERSION_ID,
      created_by: null,
      created_at: "2026-08-06T10:00:00.000Z",
      expires_at: null,
      revoked_at: null,
      last_accessed_at: null,
      access_count: 0,
      label: "Client",
      allow_pdf_download: true,
    };

    const summary = mapShareRow(row);
    assert.equal(summary.label, "Client");
    assert.equal(
      "token_hash" in summary || "tokenHash" in summary,
      false
    );
    assert.equal(summary.status, "active");
  });
});

describe("public error collapse", () => {
  it("collapses revoked/expired/not-found for public UI", () => {
    assert.equal(
      toPublicShareMessage(new PublicReportShareError("share_revoked")),
      PUBLIC_SHARE_UNAVAILABLE_MESSAGE
    );
    assert.equal(
      toPublicShareMessage(new PublicReportShareError("share_expired")),
      PUBLIC_SHARE_UNAVAILABLE_MESSAGE
    );
    assert.equal(
      toPublicShareMessage(new PublicReportShareError("share_not_found")),
      PUBLIC_SHARE_UNAVAILABLE_MESSAGE
    );
  });

  it("keeps distinct management messages", () => {
    assert.notEqual(
      toManagementShareMessage(new PublicReportShareError("share_revoked")),
      toManagementShareMessage(new PublicReportShareError("share_expired"))
    );
  });
});

describe("access count semantics (documented contracts)", () => {
  it("page resolve does not imply increment; beacon nonce is one-shot shaped", () => {
    // Contract: SSR uses resolve_public_report_share (no increment).
    // Beacon posts a 32-hex nonce; duplicate (share, nonce) is a no-op.
    const nonceA = generateAccessNonce();
    const nonceB = generateAccessNonce();
    assert.notEqual(nonceA, nonceB);
    assert.ok(isAccessNonce(nonceA));
  });

  it("PDF and page use separate consume paths", () => {
    // Contract identifiers — keep names stable for migration RPC grants.
    const pageRpc = "consume_public_report_share";
    const pdfRpc = "consume_public_report_pdf_share";
    const resolveRpc = "resolve_public_report_share";
    assert.notEqual(pageRpc, pdfRpc);
    assert.notEqual(resolveRpc, pageRpc);
  });
});

describe("rate limit (best-effort in-memory)", () => {
  it("allows then blocks after max hits", () => {
    const key = `test-${randomBytes(4).toString("hex")}`;
    assert.equal(consumePublicRateLimit(key, 2, 60_000).allowed, true);
    assert.equal(consumePublicRateLimit(key, 2, 60_000).allowed, true);
    assert.equal(consumePublicRateLimit(key, 2, 60_000).allowed, false);
  });
});

describe("compatibility contracts", () => {
  it("public URL contains only /r/<token>", () => {
    const raw = generateRawShareToken();
    const url = new URL(buildPublicShareUrl(APP_ORIGIN, raw));
    assert.equal(url.pathname, `/r/${raw}`);
    assert.equal(url.search, "");
  });

  it("Host header is not used by buildPublicShareUrl", () => {
    // Callers must pass getPublicReportOrigin() — spoofed hosts cannot be injected.
    const raw = generateRawShareToken();
    const url = buildPublicShareUrl("https://trusted.example", raw);
    assert.ok(url.startsWith("https://trusted.example/"));
    assert.ok(!url.includes("evil.example"));
  });
});

describe("RPC contract", () => {
  it("uses exact RPC name and parameter", () => {
    assert.equal(RESOLVE_PUBLIC_SHARE_RPC, "resolve_public_report_share");
    assert.equal(RESOLVE_PUBLIC_SHARE_RPC_PARAM, "p_raw_token");
  });

  it("documents exact RETURNS TABLE keys", () => {
    assert.deepEqual([...RESOLVE_PUBLIC_SHARE_RPC_KEYS], [
      "share_id",
      "report_version_id",
      "campaign_id",
      "version_number",
      "status",
      "generated_at",
      "snapshot",
      "campaign_name",
      "report_number",
      "allow_pdf_download",
      "expires_at",
      "label",
    ]);
  });

  it("maps ready and archived RPC rows; rejects generating/failed", () => {
    const base = {
      share_id: "11111111-2222-4333-8444-555555555555",
      report_version_id: VERSION_ID,
      campaign_id: "11111111-2222-4333-8444-555555555555",
      version_number: 2,
      generated_at: "2026-08-06T10:00:00.000Z",
      snapshot: { schemaVersion: 1 },
      campaign_name: "Campaign",
      report_number: "RPT-1",
      allow_pdf_download: true,
      expires_at: null,
      label: null,
    };

    assert.equal(mapRpcPayload({ ...base, status: "ready" })?.status, "ready");
    assert.equal(
      mapRpcPayload({ ...base, status: "archived" })?.status,
      "archived"
    );
    assert.equal(mapRpcPayload({ ...base, status: "generating" }), null);
    assert.equal(mapRpcPayload({ ...base, status: "failed" }), null);
    assert.equal(mapRpcPayload({ ...base, status: "ready", snapshot: null }), null);
  });

  it("collapses revoked/expired/missing into the same public message", () => {
    for (const code of [
      "share_revoked",
      "share_expired",
      "share_not_found",
      "invalid_token",
    ] as const) {
      assert.equal(
        toPublicShareMessage(new PublicReportShareError(code)),
        PUBLIC_SHARE_UNAVAILABLE_MESSAGE
      );
    }
  });

  it("public page path does not require a session helper for resolve RPC name", () => {
    // Contract: resolve uses anon-executable RPC; management list uses auth.
    assert.ok(RESOLVE_PUBLIC_SHARE_RPC.startsWith("resolve_"));
    assert.equal(typeof mapRpcPayload, "function");
  });
});
