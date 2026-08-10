import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  CREATOR_HAS_VIDEOS_DELETE_ERROR,
  buildBulkCreatorDeleteConfirmMessage,
  buildSingleCreatorDeleteConfirmMessage,
  classifyCreatorsForDeletion,
  countVideosByCreatorId,
  formatDeleteCreatorsSummary,
  runDeleteCreators,
  type DeleteCreatorCandidate,
  type DeleteCreatorsPort,
} from "@/features/creators/services/delete-creators-core";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const ID_C = "33333333-3333-4333-8333-333333333333";
const VIDEO_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function candidate(
  overrides: Partial<DeleteCreatorCandidate> & { id: string }
): DeleteCreatorCandidate {
  return {
    username: overrides.username ?? "user",
    campaignCount: overrides.campaignCount ?? 0,
    videoCount: overrides.videoCount ?? 0,
    ...overrides,
  };
}

/**
 * In-memory store that mirrors production constraints:
 * - videos.creator_id RESTRICT (delete creator blocked while videos exist)
 * - report snapshots are detached JSON (never mutated by creator delete)
 */
function createRelationalStore(seed?: {
  creators?: Array<{ id: string; username: string }>;
  videos?: Array<{ id: string; creator_id: string }>;
  campaignAssignments?: Array<{ creator_id: string }>;
}) {
  const creators = new Map(
    (seed?.creators ?? []).map((row) => [row.id, { ...row }])
  );
  const videos = [...(seed?.videos ?? [])];
  const campaignAssignments = [...(seed?.campaignAssignments ?? [])];
  const reportSnapshots = [
    {
      versionId: "report-v1",
      creators: [{ id: ID_A, username: "snapshot-user" }],
    },
  ];

  const deletedBatches: string[][] = [];
  let failVideoLookup = false;

  const port: DeleteCreatorsPort = {
    async isAuthenticated() {
      return true;
    },
    async loadCandidates(ids) {
      if (failVideoLookup) {
        throw new Error(
          "Bağlı videolar doğrulanamadı. Silme iptal edildi. Lütfen tekrar deneyin."
        );
      }

      return ids
        .filter((id) => creators.has(id))
        .map((id) => {
          const row = creators.get(id)!;
          return {
            id,
            username: row.username,
            campaignCount: campaignAssignments.filter((a) => a.creator_id === id)
              .length,
            videoCount: videos.filter((v) => v.creator_id === id).length,
          };
        });
    },
    async deleteByIds(ids) {
      // DB defense in depth: RESTRICT
      for (const id of ids) {
        if (videos.some((video) => video.creator_id === id)) {
          const err = new Error(
            'insert or update on table "videos" violates foreign key constraint "videos_creator_id_fkey"'
          );
          throw err;
        }
      }

      deletedBatches.push([...ids]);
      for (const id of ids) {
        creators.delete(id);
        for (let i = campaignAssignments.length - 1; i >= 0; i -= 1) {
          if (campaignAssignments[i].creator_id === id) {
            campaignAssignments.splice(i, 1);
          }
        }
      }
    },
  };

  return {
    port,
    creators,
    videos,
    campaignAssignments,
    reportSnapshots,
    deletedBatches,
    setFailVideoLookup(value: boolean) {
      failVideoLookup = value;
    },
  };
}

describe("delete confirmation copy", () => {
  it("builds a Turkish single-delete confirmation", () => {
    const message = buildSingleCreatorDeleteConfirmMessage({
      username: "ecemdans",
      campaignCount: 0,
    });
    assert.match(message, /Bu içerik üreticisini silmek istediğinize emin misiniz/);
    assert.match(message, /@ecemdans/);
  });

  it("includes campaign assignment context when available", () => {
    const message = buildSingleCreatorDeleteConfirmMessage({
      username: "ecemdans",
      campaignCount: 2,
    });
    assert.match(message, /2 kampanyaya atanmış/);
  });

  it("builds bulk confirmation with assigned count", () => {
    const message = buildBulkCreatorDeleteConfirmMessage({
      count: 3,
      assignedCount: 1,
    });
    assert.match(message, /3 içerik üreticisini silmek/);
    assert.match(message, /1 tanesi/);
  });
});

describe("countVideosByCreatorId", () => {
  it("counts only matching creator ids and never invents zeros for unknown rows", () => {
    const counts = countVideosByCreatorId(
      [
        { creator_id: ID_A },
        { creator_id: ID_A },
        { creator_id: ID_B },
        { creator_id: null },
      ],
      [ID_A, ID_C]
    );
    assert.equal(counts.get(ID_A), 2);
    assert.equal(counts.get(ID_C), 0);
    assert.equal(counts.has(ID_B), false);
  });
});

describe("classifyCreatorsForDeletion", () => {
  it("blocks creators that still own videos (RESTRICT)", () => {
    const { deletable, blocked } = classifyCreatorsForDeletion([
      candidate({ id: ID_A, videoCount: 0 }),
      candidate({ id: ID_B, videoCount: 2, username: "blocked" }),
    ]);
    assert.deepEqual(
      deletable.map((row) => row.id),
      [ID_A]
    );
    assert.deepEqual(
      blocked.map((row) => row.id),
      [ID_B]
    );
  });
});

describe("runDeleteCreators with relational store", () => {
  it("blocks single delete when creator has a linked video; creator and video remain", async () => {
    const store = createRelationalStore({
      creators: [{ id: ID_A, username: "hasvideo" }],
      videos: [{ id: VIDEO_A, creator_id: ID_A }],
    });

    const result = await runDeleteCreators([ID_A], store.port);

    assert.equal(result.deleted, 0);
    assert.equal(result.blocked, 1);
    assert.equal(result.error, CREATOR_HAS_VIDEOS_DELETE_ERROR);
    assert.equal(store.creators.has(ID_A), true);
    assert.equal(store.videos.length, 1);
    assert.equal(store.videos[0].creator_id, ID_A);
    assert.deepEqual(store.deletedBatches, []);
  });

  it("bulk: creator with video blocked, creator without video deleted", async () => {
    const store = createRelationalStore({
      creators: [
        { id: ID_A, username: "with-video" },
        { id: ID_B, username: "safe" },
      ],
      videos: [{ id: VIDEO_A, creator_id: ID_A }],
      campaignAssignments: [{ creator_id: ID_B }],
    });

    const result = await runDeleteCreators([ID_A, ID_B], store.port);

    assert.equal(result.deleted, 1);
    assert.equal(result.blocked, 1);
    assert.deepEqual(result.deletedIds, [ID_B]);
    assert.deepEqual(result.blockedIds, [ID_A]);
    assert.equal(store.creators.has(ID_A), true);
    assert.equal(store.creators.has(ID_B), false);
    assert.equal(store.videos.length, 1);
    assert.equal(store.videos[0].id, VIDEO_A);
    assert.match(result.success ?? "", /1 silindi/);
    assert.match(result.success ?? "", /1 engellendi/);
  });

  it("keeps immutable historical report snapshots intact after delete", async () => {
    const store = createRelationalStore({
      creators: [{ id: ID_B, username: "safe" }],
    });
    const before = structuredClone(store.reportSnapshots);

    await runDeleteCreators([ID_B], store.port);

    assert.deepEqual(store.reportSnapshots, before);
  });

  it("fail-closed: video lookup errors refuse delete", async () => {
    const store = createRelationalStore({
      creators: [{ id: ID_A, username: "maybe" }],
      videos: [{ id: VIDEO_A, creator_id: ID_A }],
    });
    store.setFailVideoLookup(true);

    const result = await runDeleteCreators([ID_A], store.port);

    assert.equal(result.deleted, 0);
    assert.equal(store.creators.has(ID_A), true);
    assert.match(result.error ?? "", /doğrulanamadı|iptal/i);
  });

  it("DB RESTRICT still blocks if preflight is wrong (defense in depth)", async () => {
    const store = createRelationalStore({
      creators: [{ id: ID_A, username: "hasvideo" }],
      videos: [{ id: VIDEO_A, creator_id: ID_A }],
    });

    // Poison preflight: claim zero videos, but store still has VIDEO_A.
    store.port.loadCandidates = async (ids) =>
      ids
        .filter((id) => store.creators.has(id))
        .map((id) => ({
          id,
          username: store.creators.get(id)!.username,
          campaignCount: 0,
          videoCount: 0,
        }));

    const result = await runDeleteCreators([ID_A], store.port);

    assert.equal(result.deleted, 0);
    assert.equal(store.creators.has(ID_A), true);
    assert.equal(store.videos.length, 1);
    assert.equal(result.error, CREATOR_HAS_VIDEOS_DELETE_ERROR);
  });

  it("rejects unauthorized requests", async () => {
    const store = createRelationalStore({
      creators: [{ id: ID_A, username: "x" }],
    });
    store.port.isAuthenticated = async () => false;

    const result = await runDeleteCreators([ID_A], store.port);

    assert.equal(result.deleted, 0);
    assert.match(result.error ?? "", /yetkiniz yok/i);
  });

  it("does not call delete when confirmation would be cancelled (UI contract)", () => {
    const button = readFileSync(
      "features/creators/components/delete-creator-button.tsx",
      "utf8"
    );
    assert.match(button, /window\.confirm/);
    assert.match(button, /if \(!confirmed\)/);
    assert.match(button, /deleteCreatorsAction/);

    const bulk = readFileSync(
      "features/creators/components/bulk-delete-creators-button.tsx",
      "utf8"
    );
    assert.match(bulk, /window\.confirm/);
    assert.match(bulk, /Seçilenleri Sil/);
    assert.match(bulk, /if \(!confirmed\)/);
  });
});

describe("delete action wiring / schema contracts", () => {
  it("fail-closes on videos query errors and rechecks before delete", () => {
    const actions = readFileSync("features/creators/actions.ts", "utf8");
    assert.match(actions, /videosResult\.error/);
    assert.match(actions, /Bağlı videolar doğrulanamadı/);
    assert.match(actions, /count: "exact"/);
    assert.match(actions, /CREATOR_HAS_VIDEOS_DELETE_ERROR/);
    assert.match(actions, /23503/);
  });

  it("ships a migration that forces videos.creator_id ON DELETE RESTRICT", () => {
    const migration = readFileSync(
      "supabase/migrations/20260809020000_videos_creator_id_on_delete_restrict.sql",
      "utf8"
    );
    assert.match(migration, /on delete restrict/i);
    assert.match(migration, /videos_creator_id_fkey/);
    assert.doesNotMatch(migration, /delete from public\.videos/i);
    assert.doesNotMatch(migration, /update public\.videos/i);
  });

  it("formats bulk summary with deleted / blocked / failed", () => {
    assert.equal(
      formatDeleteCreatorsSummary({ deleted: 2, blocked: 1, failed: 0 }),
      "2 silindi · 1 engellendi (bağlı video)"
    );
  });

  it("exposes Sil and Seçilenleri Sil on /creators table", () => {
    const directory = readFileSync(
      "features/creator-lists/components/creator-directory-selection.tsx",
      "utf8"
    );
    assert.match(directory, /DeleteCreatorButton/);
    assert.match(directory, /BulkDeleteCreatorsButton/);
  });
});
