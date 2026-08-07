import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildCreatorImportPreviewRows,
  ensureHttpsScheme,
  extractTikTokProfileCandidate,
  parseCreatorImportText,
  unwrapGoogleRedirect,
} from "@/features/creator-import/parser";
import {
  CREATOR_IMPORT_BATCH_SIZE,
  CREATOR_IMPORT_MAX_ROWS,
} from "@/features/creator-import/types";

describe("extractTikTokProfileCandidate", () => {
  it("accepts a plain TikTok profile link", () => {
    const result = extractTikTokProfileCandidate(
      "https://www.tiktok.com/@ecemdans"
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.username, "ecemdans");
    assert.equal(result.value.displayName, "ecemdans");
    assert.equal(
      result.value.profileUrl,
      "https://www.tiktok.com/@ecemdans"
    );
  });

  it("removes tracking parameters and fragments", () => {
    const result = extractTikTokProfileCandidate(
      "https://www.tiktok.com/@ecemdans?_r=1&_t=abc&is_from_webapp=1&sender_device=pc#section"
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.profileUrl, "https://www.tiktok.com/@ecemdans");
    assert.doesNotMatch(result.value.profileUrl, /[?#]/);
  });

  it("accepts www links without a scheme", () => {
    const result = extractTikTokProfileCandidate("www.tiktok.com/@ecem.dans_01");

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.username, "ecem.dans_01");
    assert.equal(
      result.value.profileUrl,
      "https://www.tiktok.com/@ecem.dans_01"
    );
  });

  it("accepts Markdown TikTok links", () => {
    const result = extractTikTokProfileCandidate(
      "[https://www.tiktok.com/@ecemdans](https://www.tiktok.com/@ecemdans?is_from_webapp=1)"
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.username, "ecemdans");
  });

  it("extracts TikTok URLs from Google redirect q parameters", () => {
    const encoded =
      "https://www.google.com/url?q=https%3A%2F%2Fwww.tiktok.com%2F%40ecemdans&sa=D";
    const result = extractTikTokProfileCandidate(encoded);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.profileUrl, "https://www.tiktok.com/@ecemdans");
  });

  it("URL-decodes Google redirect targets", () => {
    const inner = unwrapGoogleRedirect(
      "https://www.google.com/url?q=https%3A%2F%2Fwww.tiktok.com%2F%40user_name"
    );
    assert.equal(inner, "https://www.tiktok.com/@user_name");
  });

  it("preserves dots and underscores in usernames", () => {
    const result = extractTikTokProfileCandidate(
      "https://www.tiktok.com/@a.b_c"
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.username, "a.b_c");
  });

  it("sets display_name equal to username initially", () => {
    const result = extractTikTokProfileCandidate(
      "https://www.tiktok.com/@CreatorCase"
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.username, "creatorcase");
    assert.equal(result.value.displayName, result.value.username);
  });

  it("rejects malformed links", () => {
    const result = extractTikTokProfileCandidate("not a link at all");
    assert.equal(result.ok, false);
  });

  it("rejects video URLs", () => {
    const result = extractTikTokProfileCandidate(
      "https://www.tiktok.com/@ecemdans/video/7301234567890123456"
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, "invalid_link");
  });

  it("rejects music URLs", () => {
    const result = extractTikTokProfileCandidate(
      "https://www.tiktok.com/music/midnight-drive-123456"
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, "invalid_link");
  });

  it("rejects unsafe schemes", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:text/html;base64,aaaa",
      "blob:https://example.com/uuid",
    ]) {
      assert.equal(ensureHttpsScheme(value), null, value);
      const result = extractTikTokProfileCandidate(value);
      assert.equal(result.ok, false, value);
    }
  });

  it("rejects Google search text without a TikTok q target", () => {
    const result = extractTikTokProfileCandidate(
      "https://www.google.com/search?q=tiktok+dance"
    );
    assert.equal(result.ok, false);
  });

  it("produces a canonical https://www.tiktok.com/@username URL", () => {
    const result = extractTikTokProfileCandidate(
      "http://m.tiktok.com/@EcemDans/"
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.profileUrl, "https://www.tiktok.com/@ecemdans");
  });
});

describe("parseCreatorImportText", () => {
  it("marks duplicates inside the pasted list", () => {
    const parsed = parseCreatorImportText(`
https://www.tiktok.com/@one
https://www.tiktok.com/@ONE
https://www.tiktok.com/@two
`);
    const { rows, totals } = buildCreatorImportPreviewRows(parsed, new Set());

    assert.equal(totals.ready, 2);
    assert.equal(totals.duplicateInList, 1);
    assert.equal(rows[1]?.status, "duplicate_in_list");
  });

  it("marks existing creators as skipped", () => {
    const parsed = parseCreatorImportText(
      "https://www.tiktok.com/@existing\nhttps://www.tiktok.com/@fresh"
    );
    const { rows, totals } = buildCreatorImportPreviewRows(
      parsed,
      new Set(["existing"])
    );

    assert.equal(totals.existing, 1);
    assert.equal(totals.ready, 1);
    assert.equal(rows[0]?.status, "existing");
    assert.equal(rows[1]?.status, "ready");
  });

  it("treats case-insensitive usernames as the same creator", () => {
    const parsed = parseCreatorImportText(
      "https://www.tiktok.com/@EcemDans"
    );
    const { totals } = buildCreatorImportPreviewRows(
      parsed,
      new Set(["ecemdans"])
    );
    assert.equal(totals.existing, 1);
    assert.equal(totals.ready, 0);
  });

  it("ignores fee and other unknown CSV columns", () => {
    const csv = `name,fee,tiktok_url,notes
Ecem,1500,https://www.tiktok.com/@ecemdans,vip
Other,0,https://www.tiktok.com/@other,`;
    const parsed = parseCreatorImportText(csv);
    assert.equal(parsed.candidates.length, 2);
    assert.equal(parsed.candidates[0]?.ok, true);
    if (!parsed.candidates[0]?.ok) return;
    assert.equal(parsed.candidates[0].value.username, "ecemdans");
  });

  it("enforces the maximum row limit", () => {
    const lines = Array.from(
      { length: CREATOR_IMPORT_MAX_ROWS + 1 },
      (_, index) => `https://www.tiktok.com/@user${index}`
    ).join("\n");

    const parsed = parseCreatorImportText(lines);
    assert.ok(parsed.error);
    assert.match(parsed.error ?? "", /500/);
  });

  it("rejects excessively large pasted text", () => {
    const huge = "https://www.tiktok.com/@a\n".repeat(40_000);
    const parsed = parseCreatorImportText(huge);
    assert.ok(parsed.error);
  });
});

describe("import contracts", () => {
  it("uses bounded batch insertion size", () => {
    assert.equal(CREATOR_IMPORT_BATCH_SIZE, 50);
  });

  it("does not call Apify or fetch during parse", () => {
    const source = readFileSync("features/creator-import/parser.ts", "utf8");
    assert.doesNotMatch(source, /apify/i);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /createApifyTikTokProvider/);
  });

  it("does not import fees in the insert payload", () => {
    const source = readFileSync("features/creator-import/queries.ts", "utf8");
    assert.doesNotMatch(source, /\bfee\b/);
    assert.match(source, /avatar_url:\s*null/);
    assert.match(source, /follower_count:\s*0/);
    assert.match(source, /category:\s*null/);
    assert.match(source, /category_source:\s*"auto"/);
  });

  it("imports creators as uncategorized with auto source", () => {
    const source = readFileSync("features/creator-import/queries.ts", "utf8");
    assert.match(source, /category:\s*null/);
    assert.doesNotMatch(source, /category:\s*"micro"/);
  });

  it("keeps repeated import idempotent via unique constraint handling", () => {
    const source = readFileSync("features/creator-import/actions.ts", "utf8");
    assert.match(source, /23505/);
    assert.match(source, /racedExisting/);
    assert.doesNotMatch(source, /\.update\(/);
  });

  it("wires post-import sync with concurrency 2 and no auto-run", () => {
    const actions = readFileSync("features/creator-import/actions.ts", "utf8");
    const form = readFileSync(
      "features/creator-import/components/creator-import-form.tsx",
      "utf8"
    );

    assert.match(actions, /BULK_CONCURRENCY/);
    assert.match(actions, /syncTikTokCreator/);
    assert.match(actions, /buildCreatorImportSyncRow/);
    assert.match(form, /Yeni Eklenen TikTok Profillerini Güncelle/);
    assert.match(form, /sağlayıcı isteği oluşturur/);
    assert.match(form, /CreatorImportSyncFailures/);
    // Sync runs only from the explicit button handler, never after import alone.
    assert.match(form, /onClick=\{handleSync\}/);
    const importHandler = form.match(
      /function handleImport\(\) \{[\s\S]*?\n  \}/
    )?.[0] ?? "";
    assert.doesNotMatch(importHandler, /syncImportedCreatorsAction/);
  });
});
