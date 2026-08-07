import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  assertNoPrivatePublicLeakage,
  averageFollowers,
  buildCreatorListCsv,
  buildCreatorListCsvFilename,
  calculateCreatorListStats,
  categoryDistribution,
  escapeCsvField,
  medianFollowers,
  mergeSelection,
  normalizeSelectedCreatorIds,
  totalFollowers,
} from "@/features/creator-lists/calculations";
import {
  areAllVisibleSelected,
  clearCreatorSelection,
  createEmptySelection,
  selectVisibleCreators,
  toggleCreatorSelection,
} from "@/features/creator-lists/selection";
import { buildPublicCreatorListUrl } from "@/features/creator-lists/token";
import {
  generateRawShareToken,
  hashShareToken,
} from "@/features/public-reports/token";

describe("creator list selection", () => {
  it("selects and unselects creators", () => {
    let state = createEmptySelection();
    state = toggleCreatorSelection(state, "a", true);
    state = toggleCreatorSelection(state, "b", true);
    assert.deepEqual(state.selectedIds, ["a", "b"]);
    state = toggleCreatorSelection(state, "a", false);
    assert.deepEqual(state.selectedIds, ["b"]);
  });

  it("selects only currently visible results", () => {
    let state = toggleCreatorSelection(createEmptySelection(), "hidden", true);
    state = selectVisibleCreators(state, ["a", "b"], true);
    assert.deepEqual(state.selectedIds.sort(), ["a", "b", "hidden"]);
    assert.equal(areAllVisibleSelected(state.selectedIds, ["a", "b"]), true);
    state = selectVisibleCreators(state, ["a", "b"], false);
    assert.deepEqual(state.selectedIds, ["hidden"]);
  });

  it("does not auto-select hidden creators when filters change", () => {
    const state = selectVisibleCreators(createEmptySelection(), ["a"], true);
    assert.deepEqual(state.selectedIds, ["a"]);
    assert.equal(areAllVisibleSelected(state.selectedIds, ["a", "b"]), false);
  });

  it("enforces the maximum selection limit", () => {
    const many = Array.from({ length: 501 }, (_, index) => `id-${index}`);
    const normalized = normalizeSelectedCreatorIds(many);
    assert.equal(normalized.length, 500);
    const merged = mergeSelection([], many, true);
    assert.equal(merged.ids.length, 500);
    assert.equal(merged.limited, true);
  });

  it("clears selection", () => {
    const state = clearCreatorSelection();
    assert.deepEqual(state.selectedIds, []);
  });
});

describe("creator list calculations", () => {
  const creators = [
    { id: "1", follower_count: 100_000, category: "macro", platform: "tiktok" },
    { id: "2", follower_count: 20_000, category: "micro", platform: "tiktok" },
    { id: "1", follower_count: 100_000, category: "macro", platform: "tiktok" },
    { id: "3", follower_count: 1_500_000, category: "mega", platform: "instagram" },
  ];

  it("deduplicates creator IDs and stays zero-safe", () => {
    assert.equal(totalFollowers([]), 0);
    assert.equal(totalFollowers(creators), 1_620_000);
    assert.equal(averageFollowers([]), null);
    assert.equal(averageFollowers(creators), 540_000);
  });

  it("computes median followers without rounding", () => {
    assert.equal(medianFollowers(creators), 100_000);
    assert.equal(
      medianFollowers([
        { id: "a", follower_count: 10 },
        { id: "b", follower_count: 20 },
      ]),
      15
    );
  });

  it("computes category distribution and full stats", () => {
    assert.deepEqual(categoryDistribution(creators), {
      macro: 1,
      micro: 1,
      mega: 1,
    });
    const stats = calculateCreatorListStats(creators);
    assert.equal(stats.creatorCount, 3);
    assert.equal(stats.tiktokCount, 2);
    assert.equal(stats.minFollowers, 20_000);
    assert.equal(stats.maxFollowers, 1_500_000);
  });
});

describe("creator list privacy", () => {
  it("rejects private fields in public payloads", () => {
    assert.throws(
      () =>
        assertNoPrivatePublicLeakage({
          username: "x",
          internal_notes: "secret",
        }),
      /private_field_leak:internal_notes/
    );
    assert.throws(
      () => assertNoPrivatePublicLeakage({ fee: 100 }),
      /private_field_leak:fee/
    );
    assert.throws(
      () => assertNoPrivatePublicLeakage({ token_hash: "abc" }),
      /private_field_leak:token_hash/
    );
    assert.doesNotThrow(() =>
      assertNoPrivatePublicLeakage({
        username: "x",
        display_name: "X",
        public_note: "ok",
        follower_count: 1,
      })
    );
  });

  it("public URL builder never embeds token hash", () => {
    const raw = generateRawShareToken();
    const hash = hashShareToken(raw);
    const url = buildPublicCreatorListUrl("https://reports.befluencer.co", raw);
    assert.equal(url.includes(hash), false);
    assert.match(url, /\/lists\/[0-9a-f]{64}$/);
  });
});

describe("creator list CSV", () => {
  it("uses public columns, UTF-8 BOM, semicolon delimiter and escaping", () => {
    const csv = buildCreatorListCsv([
      {
        position: 1,
        username: "ayar",
        displayName: "Ayşe; Test",
        platform: "tiktok",
        category: "macro",
        followerCount: 120_000,
        profileUrl: "https://www.tiktok.com/@ayar",
        publicNote: 'not "gizli"',
      },
    ]);

    assert.equal(csv.startsWith("\uFEFF"), true);
    assert.match(csv, /Sıra;Kullanıcı Adı;Görünen Ad/);
    assert.match(csv, /"Ayşe; Test"/);
    assert.match(csv, /"not ""gizli"""/);
    assert.equal(csv.includes("internal"), false);
    assert.equal(csv.includes("fee"), false);
  });

  it("prevents CSV injection", () => {
    assert.equal(escapeCsvField("=cmd"), "'=cmd");
    assert.equal(escapeCsvField("+1"), "'+1");
    assert.equal(escapeCsvField("-2"), "'-2");
    assert.equal(escapeCsvField("@x"), "'@x");
  });

  it("builds a safe filename", () => {
    assert.equal(
      buildCreatorListCsvFilename("Macro TikTok 100K–500K"),
      "befluencer-creator-listesi-macro-tiktok-100k-500k.csv"
    );
  });
});

describe("creator list campaign handoff helpers", () => {
  it("computes missing vs already assigned", () => {
    const selected = ["a", "b", "c"];
    const already = new Set(["b"]);
    const missing = selected.filter((id) => !already.has(id));
    assert.deepEqual(missing, ["a", "c"]);
    assert.equal(already.size, 1);
  });
});

describe("creator list supabase error mapping", () => {
  it("maps missing-table / schema-cache errors to migration_missing", async () => {
    const { mapCreatorListSupabaseError } = await import(
      "@/features/creator-lists/diagnostics"
    );
    const { CreatorListError } = await import(
      "@/features/creator-lists/errors"
    );

    assert.equal(
      mapCreatorListSupabaseError({
        code: "PGRST205",
        message: "Could not find the table 'public.creator_lists' in the schema cache",
      }),
      "migration_missing"
    );
    assert.equal(
      mapCreatorListSupabaseError({
        code: "42P01",
        message: 'relation "creator_lists" does not exist',
      }),
      "migration_missing"
    );
    assert.equal(
      mapCreatorListSupabaseError({
        code: "42501",
        message: "permission denied for table creator_lists",
      }),
      "rls_denied"
    );
    assert.equal(
      mapCreatorListSupabaseError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      }),
      "duplicate_item"
    );

    const { creatorListErrorMessage, resolveCreatorListUserMessage } =
      await import("@/features/creator-lists/errors");
    assert.match(
      creatorListErrorMessage("migration_missing"),
      /20260805310000/
    );
    assert.equal(
      resolveCreatorListUserMessage("migration_missing", "production"),
      "Veritabanı hatası oluştu. Lütfen tekrar deneyin."
    );
    assert.match(
      resolveCreatorListUserMessage("migration_missing", "development"),
      /20260805310000/
    );
  });
});

describe("creator list compatibility contracts", () => {
  it("does not call providers during list feature modules", () => {
    const root = path.join(process.cwd(), "features", "creator-lists");
    const files = [
      "actions.ts",
      "queries.ts",
      "calculations.ts",
      "selection.ts",
    ];

    for (const file of files) {
      const source = readFileSync(path.join(root, file), "utf8");
      assert.equal(source.includes("createApifyTikTokProvider"), false);
      assert.equal(source.includes("fetchCreatorProfile"), false);
      assert.equal(source.includes("chromium"), false);
    }
  });

  it("public RPC migration never selects internal notes or fees", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "supabase",
        "migrations",
        "20260805310000_creator_lists.sql"
      ),
      "utf8"
    );
    const fixSql = readFileSync(
      path.join(
        process.cwd(),
        "supabase",
        "migrations",
        "20260805320000_fix_creator_list_public_share.sql"
      ),
      "utf8"
    );

    assert.match(sql, /resolve_public_creator_list/);
    assert.match(sql, /consume_public_creator_list/);
    assert.equal(sql.includes("i.internal_note"), false);
    assert.equal(sql.includes("l.internal_notes"), false);
    assert.equal(/\bfee\b/.test(sql.replace(/--.*$/gm, "")), false);
    assert.match(sql, /public_note/);
    assert.match(fixSql, /extensions\.digest/);
    assert.match(fixSql, /set search_path = public, extensions, pg_temp/);
  });
});
