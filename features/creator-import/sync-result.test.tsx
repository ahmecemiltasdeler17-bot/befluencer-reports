import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CreatorImportSyncFailures } from "@/features/creator-import/components/creator-import-sync-failures";
import {
  buildCreatorImportSyncRow,
  failedCreatorIdsFromSyncResult,
  mapCreatorImportSyncError,
  mergeCreatorImportSyncResults,
  summarizeCreatorImportSyncRows,
} from "@/features/creator-import/sync-result";
import type { CreatorImportSyncResult } from "@/features/creator-import/types";

function resultWith(
  rows: CreatorImportSyncResult["rows"]
): CreatorImportSyncResult {
  return summarizeCreatorImportSyncRows(rows);
}

describe("mapCreatorImportSyncError", () => {
  it("maps sanitized Turkish messages to stable codes", () => {
    assert.equal(
      mapCreatorImportSyncError("TikTok profili bulunamadı.").errorCode,
      "creator_unavailable"
    );
    assert.equal(
      mapCreatorImportSyncError(
        "Sağlayıcı farklı bir TikTok hesabı döndürdü. Kullanıcı adını kontrol edin."
      ).errorCode,
      "username_mismatch"
    );
    assert.equal(
      mapCreatorImportSyncError("Takipçi sayısı alınamadı.").errorMessage,
      "Takipçi sayısı alınamadı."
    );
    assert.equal(
      mapCreatorImportSyncError(
        "TikTok veri sağlayıcı kullanım kotası doldu. Apify hesabınızı veya planınızı kontrol edin."
      ).errorMessage,
      "Sağlayıcı kullanım kotası doldu. Apify hesabınızı kontrol edin."
    );
    assert.equal(
      mapCreatorImportSyncError(
        "TikTok veri sağlayıcı geçici olarak kullanılamıyor."
      ).errorMessage,
      "Geçici sağlayıcı hatası. Tekrar deneyin."
    );
    assert.equal(
      mapCreatorImportSyncError("İstek zaman aşımına uğradı.").errorCode,
      "timeout"
    );
  });

  it("never returns raw provider payload or SQL text", () => {
    const mapped = mapCreatorImportSyncError(
      'duplicate key value violates unique constraint "creators_platform_username_key" token=sk-abc payload={"items":[]}'
    );
    assert.equal(mapped.errorCode, "unknown");
    assert.doesNotMatch(mapped.errorMessage, /duplicate key|sk-abc|items/i);
  });
});

describe("bulk sync result rows", () => {
  it("builds a mixed success/failure result with usernames", () => {
    const rows = [
      buildCreatorImportSyncRow({
        creatorId: "11111111-1111-4111-8111-111111111111",
        username: "ok_user",
        profileUrl: "https://www.tiktok.com/@ok_user",
        outcome: "success",
      }),
      buildCreatorImportSyncRow({
        creatorId: "22222222-2222-4222-8222-222222222222",
        username: "missing_user",
        profileUrl: "https://www.tiktok.com/@missing_user",
        outcome: "failed",
        message: "TikTok profili bulunamadı.",
      }),
    ];

    const summary = summarizeCreatorImportSyncRows(rows);
    assert.equal(summary.success, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.rows[1]?.username, "missing_user");
    assert.equal(summary.rows[1]?.errorCode, "creator_unavailable");
    assert.equal(
      summary.rows[1]?.errorMessage,
      "TikTok hesabı bulunamadı veya kullanılamıyor."
    );
    assert.match(summary.message ?? "", /1 profil güncellendi, 1 başarısız/);
  });

  it("retries only failed creator IDs and preserves successes", () => {
    const previous = resultWith([
      buildCreatorImportSyncRow({
        creatorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        username: "ok_user",
        profileUrl: "https://www.tiktok.com/@ok_user",
        outcome: "success",
      }),
      buildCreatorImportSyncRow({
        creatorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        username: "bad_user",
        profileUrl: "https://www.tiktok.com/@bad_user",
        outcome: "failed",
        message: "TikTok profili bulunamadı.",
      }),
    ]);

    assert.deepEqual(failedCreatorIdsFromSyncResult(previous), [
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ]);
    assert.equal(
      failedCreatorIdsFromSyncResult(previous).includes(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      ),
      false
    );

    const retry = resultWith([
      buildCreatorImportSyncRow({
        creatorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        username: "bad_user",
        profileUrl: "https://www.tiktok.com/@bad_user",
        outcome: "success",
      }),
    ]);

    const merged = mergeCreatorImportSyncResults(previous, retry);
    assert.equal(merged.success, 2);
    assert.equal(merged.failed, 0);
    assert.equal(merged.rows[0]?.status, "success");
    assert.equal(merged.rows[0]?.username, "ok_user");
    assert.equal(merged.rows[1]?.status, "success");
  });

  it("hides the empty failure list in the UI", () => {
    const html = renderToStaticMarkup(
      <CreatorImportSyncFailures
        failedRows={[]}
        isPending={false}
        onRetryAll={() => undefined}
        onRetryOne={() => undefined}
      />
    );
    assert.equal(html, "");
  });

  it("renders usernames and sanitized errors for failures", () => {
    const html = renderToStaticMarkup(
      <CreatorImportSyncFailures
        failedRows={[
          buildCreatorImportSyncRow({
            creatorId: "22222222-2222-4222-8222-222222222222",
            username: "missing_user",
            profileUrl: "https://www.tiktok.com/@missing_user",
            outcome: "failed",
            message: "TikTok profili bulunamadı.",
          }),
        ]}
        isPending={false}
        onRetryAll={() => undefined}
        onRetryOne={() => undefined}
      />
    );

    assert.match(html, /Başarısız Profiller/);
    assert.match(html, /@missing_user/);
    assert.match(html, /TikTok hesabı bulunamadı veya kullanılamıyor/);
    assert.match(html, /Tüm Başarısızları Tekrar Dene/);
    assert.match(html, /Tekrar Dene/);
    assert.doesNotMatch(html, /apify|stack|duplicate key/i);
  });

  it("wires retry to failed IDs only in the import form", () => {
    const form = readFileSync(
      "features/creator-import/components/creator-import-form.tsx",
      "utf8"
    );
    assert.match(form, /failedCreatorIdsFromSyncResult/);
    assert.match(form, /mergeCreatorImportSyncResults/);
    assert.match(form, /handleRetryFailedIds/);
  });

  it("bulk import sync uses creator batch orchestration", () => {
    const source = readFileSync("features/creator-import/actions.ts", "utf8");
    assert.match(source, /orchestrateCreatorBatchFetches/);
    assert.match(source, /fetchCreatorProfilesBatch/);
    assert.doesNotMatch(source, /BULK_CONCURRENCY/);
    assert.doesNotMatch(source, /mapWithConcurrency/);
  });
});
