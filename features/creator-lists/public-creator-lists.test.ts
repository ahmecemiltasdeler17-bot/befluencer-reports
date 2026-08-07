import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { assertNoPrivatePublicLeakage } from "@/features/creator-lists/calculations";
import { PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE } from "@/features/creator-lists/errors";
import {
  FORBIDDEN_PUBLIC_CREATOR_LIST_KEYS,
  PUBLIC_CREATOR_ITEM_KEYS,
  RESOLVE_PUBLIC_CREATOR_LIST_RPC,
  RESOLVE_PUBLIC_CREATOR_LIST_RPC_KEYS,
  RESOLVE_PUBLIC_CREATOR_LIST_RPC_PARAM,
  assertPublicCreatorListPayloadSafe,
  firstCreatorListRpcRow,
  mapCreatorListRpcPayload,
} from "@/features/creator-lists/rpc-contract";
import {
  buildPublicCreatorListUrl,
  generateRawShareToken,
  hashShareToken,
  isRawShareToken,
  normalizeRouteShareToken,
} from "@/features/creator-lists/token";

const FIX_MIGRATION = "20260805320000_fix_creator_list_public_share.sql";
const ORIGINAL_MIGRATION = "20260805310000_creator_lists.sql";

describe("creator-list public token hashing", () => {
  it("uses Node SHA-256 utf8 hex identical to Postgres digest vector", () => {
    const raw = "a".repeat(64);
    const expected =
      "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb";
    const nodeHash = createHash("sha256").update(raw, "utf8").digest("hex");

    assert.equal(hashShareToken(raw), expected);
    assert.equal(nodeHash, expected);
    assert.ok(/^[0-9a-f]{64}$/.test(nodeHash));
  });

  it("does not double-hash or uppercase the raw token", () => {
    const raw = generateRawShareToken();
    assert.ok(isRawShareToken(raw));
    assert.equal(raw, raw.toLowerCase());
    assert.notEqual(hashShareToken(raw), raw);
    assert.equal(hashShareToken(hashShareToken(raw)).length, 64);
    assert.notEqual(hashShareToken(raw), hashShareToken(hashShareToken(raw)));
  });

  it("route normalization leaves the raw token unchanged", () => {
    const raw = generateRawShareToken();
    assert.equal(normalizeRouteShareToken(raw), raw);
  });
});

describe("creator-list public URL origin", () => {
  it("builds /lists/<token> from PUBLIC_REPORT_URL origin", () => {
    const raw = generateRawShareToken();
    const url = buildPublicCreatorListUrl(
      "https://reports.befluencer.co",
      raw
    );
    assert.equal(url, `https://reports.befluencer.co/lists/${raw}`);
  });

  it("uses localhost origin for local shares", () => {
    const raw = generateRawShareToken();
    const url = buildPublicCreatorListUrl("http://localhost:3000", raw);
    assert.equal(url, `http://localhost:3000/lists/${raw}`);
  });

  it("never embeds token_hash in the public URL", () => {
    const raw = generateRawShareToken();
    const hash = hashShareToken(raw);
    const url = buildPublicCreatorListUrl("https://reports.befluencer.co", raw);
    assert.equal(url.includes(hash), false);
  });
});

describe("creator-list RPC contract", () => {
  it("uses exact RPC name and parameter", () => {
    assert.equal(RESOLVE_PUBLIC_CREATOR_LIST_RPC, "resolve_public_creator_list");
    assert.equal(RESOLVE_PUBLIC_CREATOR_LIST_RPC_PARAM, "p_raw_token");
  });

  it("documents exact RETURNS TABLE keys", () => {
    assert.deepEqual([...RESOLVE_PUBLIC_CREATOR_LIST_RPC_KEYS], [
      "share_id",
      "list_id",
      "list_name",
      "description",
      "status",
      "allow_csv_download",
      "expires_at",
      "label",
      "creator_count",
      "creators",
      "stats",
    ]);
  });

  it("maps RPC rows including nullable category/avatar/public_note", () => {
    const payload = mapCreatorListRpcPayload({
      share_id: "11111111-2222-4333-8444-555555555555",
      list_id: "22222222-3333-4444-8555-666666666666",
      list_name: "Macro shortlist",
      description: "Public pitch",
      status: "ready",
      allow_csv_download: true,
      expires_at: null,
      label: "Client A",
      creator_count: 2,
      creators: [
        {
          position: 0,
          username: "one",
          display_name: "One",
          profile_url: "https://www.tiktok.com/@one",
          avatar_url: null,
          platform: "tiktok",
          category: null,
          follower_count: "120000",
          public_note: null,
        },
        {
          position: 1,
          username: "two",
          display_name: null,
          profile_url: null,
          avatar_url: "https://cdn.example/a.jpg",
          platform: "instagram",
          category: "macro",
          follower_count: 50,
          public_note: "note",
        },
      ],
      stats: {
        creator_count: 2,
        total_followers: 120050,
        platform_distribution: { tiktok: 1, instagram: 1 },
        category_distribution: { uncategorized: 1, macro: 1 },
      },
    });

    assert.ok(payload);
    assert.equal(payload!.listId, "22222222-3333-4444-8555-666666666666");
    assert.equal(payload!.listName, "Macro shortlist");
    assert.equal(payload!.creators[0].follower_count, 120000);
    assert.equal(payload!.creators[0].category, null);
    assert.equal(payload!.creators[0].avatar_url, null);
    assert.equal(payload!.creators[0].public_note, null);
    assert.equal(payload!.creators[1].public_note, "note");
    assert.doesNotThrow(() => assertPublicCreatorListPayloadSafe(payload!));
  });

  it("handles empty creator arrays", () => {
    const payload = mapCreatorListRpcPayload({
      share_id: "11111111-2222-4333-8444-555555555555",
      list_name: "Empty",
      description: null,
      allow_csv_download: false,
      creators: [],
      stats: {
        creator_count: 0,
        total_followers: 0,
        platform_distribution: {},
        category_distribution: {},
      },
    });

    assert.ok(payload);
    assert.equal(payload!.creators.length, 0);
    assert.equal(payload!.stats.creator_count, 0);
  });

  it("parses first row from array or object RPC envelopes", () => {
    const row = {
      share_id: "11111111-2222-4333-8444-555555555555",
      list_name: "X",
      description: null,
      allow_csv_download: false,
      creators: [],
      stats: {},
    };
    assert.equal(firstCreatorListRpcRow([row])?.share_id, row.share_id);
    assert.equal(firstCreatorListRpcRow(row)?.list_name, "X");
    assert.equal(firstCreatorListRpcRow(null), null);
  });

  it("rejects private fields in public payload safety check", () => {
    assert.throws(
      () =>
        assertNoPrivatePublicLeakage({
          username: "x",
          internal_notes: "secret",
        }),
      /private_field_leak:internal_notes/
    );

    for (const key of FORBIDDEN_PUBLIC_CREATOR_LIST_KEYS) {
      assert.throws(
        () =>
          assertPublicCreatorListPayloadSafe({
            shareId: "11111111-2222-4333-8444-555555555555",
            listName: "X",
            description: null,
            allowCsvDownload: false,
            expiresAt: null,
            label: null,
            creators: [],
            stats: {
              creator_count: 0,
              total_followers: 0,
              platform_distribution: {},
              category_distribution: {},
              [key]: "leak",
            },
          } as never),
        new RegExp(`private_field_leak:${key}`)
      );
    }

    assert.equal(
      (PUBLIC_CREATOR_ITEM_KEYS as readonly string[]).includes("username"),
      true
    );
    assert.equal(
      (PUBLIC_CREATOR_ITEM_KEYS as readonly string[]).includes("internal_notes"),
      false
    );
  });

  it("public route contract requires no session for resolve RPC", () => {
    assert.ok(RESOLVE_PUBLIC_CREATOR_LIST_RPC.startsWith("resolve_"));
    assert.equal(typeof mapCreatorListRpcPayload, "function");
  });
});

describe("creator-list unavailable message", () => {
  it("keeps a generic Turkish unavailable message", () => {
    assert.match(PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE, /erişilemiyor|geçersiz|kullanılamıyor/i);
    assert.equal(
      PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE.includes("token"),
      false
    );
  });
});

describe("creator-list public share SQL contracts", () => {
  const fixSql = readFileSync(
    path.join(process.cwd(), "supabase", "migrations", FIX_MIGRATION),
    "utf8"
  );
  const originalSql = readFileSync(
    path.join(process.cwd(), "supabase", "migrations", ORIGINAL_MIGRATION),
    "utf8"
  );

  it("fix migration uses extensions.digest and safe search_path", () => {
    assert.match(fixSql, /extensions\.digest\(convert_to\(p_raw_token, 'UTF8'\), 'sha256'\)/);
    assert.match(fixSql, /set search_path = public, extensions, pg_temp/);
    assert.match(fixSql, /security definer/);
    assert.match(fixSql, /grant execute on function public\.resolve_public_creator_list\(text\)/);
    assert.match(fixSql, /to anon, authenticated/);
    assert.match(fixSql, /left join public\.creators/);
  });

  it("original migration had the broken digest/search_path pattern", () => {
    assert.match(originalSql, /set search_path = public, pg_temp/);
    assert.match(originalSql, /encode\(digest\(p_raw_token, 'sha256'\), 'hex'\)/);
    assert.equal(originalSql.includes("extensions.digest"), false);
  });

  it("never returns internal notes, fees, or token_hash from public RPCs", () => {
    for (const sql of [fixSql, originalSql]) {
      assert.equal(sql.includes("i.internal_note"), false);
      assert.equal(sql.includes("l.internal_notes"), false);
      assert.equal(sql.includes("token_hash,"), false);
      assert.equal(/\bfee\b/.test(sql.replace(/--.*$/gm, "")), false);
    }
  });

  it("CSV consume requires allow_csv_download", () => {
    assert.match(fixSql, /allow_csv_download = true/);
    assert.match(fixSql, /consume_public_creator_list_csv/);
  });

  it("share insert table stores token_hash not raw token column for URL", () => {
    assert.match(originalSql, /token_hash text not null/);
    assert.match(
      originalSql,
      /create table if not exists public\.creator_list_shares \([\s\S]*?token_hash text not null[\s\S]*?\);/
    );
    // Column names only — RPC params may still be named p_raw_token.
    assert.equal(/\n\s+raw_token\s+/i.test(originalSql), false);
  });

  it("usable share rejects revoked/expired via helper", () => {
    assert.match(
      originalSql,
      /p_revoked_at is null[\s\S]*p_expires_at is null or p_expires_at > timezone/
    );
  });
});

describe("creator-list public page route contracts", () => {
  it("public page is outside protected layout and force-dynamic", () => {
    const page = readFileSync(
      path.join(
        process.cwd(),
        "app",
        "(public-content)",
        "lists",
        "[token]",
        "page.tsx"
      ),
      "utf8"
    );
    const layout = readFileSync(
      path.join(process.cwd(), "app", "(public-content)", "layout.tsx"),
      "utf8"
    );
    const proxy = readFileSync(path.join(process.cwd(), "proxy.ts"), "utf8");

    assert.match(page, /force-dynamic/);
    assert.match(page, /revalidate = 0/);
    assert.match(page, /resolvePublicCreatorList/);
    assert.match(page, /PublicListUnavailable/);
    assert.equal(page.includes("ManagementNav"), false);
    assert.equal(layout.includes("ManagementNav"), false);
    assert.match(proxy, /\/lists\//);
    assert.match(proxy, /private, no-store/);
  });

  it("share action builds URL via getPublicReportOrigin", () => {
    const actions = readFileSync(
      path.join(process.cwd(), "features", "creator-lists", "actions.ts"),
      "utf8"
    );
    assert.match(actions, /getPublicReportOrigin\(\)/);
    assert.match(actions, /buildPublicCreatorListUrl/);
    assert.equal(actions.includes("headers().get(\"host\")"), false);
    assert.equal(actions.includes("x-forwarded-host"), false);
  });
});
