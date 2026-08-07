import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  areAllVisibleSelected,
  createEmptySelection,
  selectVisibleCreators,
  toggleCreatorSelection,
} from "@/features/creator-lists/selection";
import type { CreatorGrowth } from "@/features/creator-sync/queries";
import type { CreatorWithCampaignCount } from "@/features/creators/types";
import {
  creatorDirectorySortButtonLabelTr,
  cycleCreatorDirectorySort,
  parseCreatorDirectorySortState,
  sortCreatorDirectoryRows,
} from "@/features/creators/directory-sort";

function makeCreator(
  overrides: Partial<CreatorWithCampaignCount> & { id: string }
): CreatorWithCampaignCount {
  return {
    platform: "tiktok",
    username: overrides.username ?? overrides.id,
    display_name: overrides.display_name ?? null,
    profile_url: null,
    avatar_url: null,
    follower_count: overrides.follower_count ?? 0,
    category: overrides.category ?? null,
    category_source: "auto",
    last_synced_at: overrides.last_synced_at ?? null,
    sync_status: overrides.sync_status ?? "pending",
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00.000Z",
    campaign_count: overrides.campaign_count ?? 0,
    ...overrides,
  };
}

function ids(rows: CreatorWithCampaignCount[]): string[] {
  return rows.map((row) => row.id);
}

describe("parseCreatorDirectorySortState", () => {
  it("ignores invalid URL sort values", () => {
    assert.deepEqual(
      parseCreatorDirectorySortState({ sort: "views", direction: "desc" }),
      { sort: null, direction: null }
    );
    assert.deepEqual(
      parseCreatorDirectorySortState({ sort: "followers", direction: "sideways" }),
      { sort: "followers", direction: "asc" }
    );
  });

  it("accepts allowlisted sort and direction", () => {
    assert.deepEqual(
      parseCreatorDirectorySortState({ sort: "followers", direction: "desc" }),
      { sort: "followers", direction: "desc" }
    );
  });
});

describe("cycleCreatorDirectorySort", () => {
  it("cycles default → asc → desc → default", () => {
    let state = parseCreatorDirectorySortState({});
    state = cycleCreatorDirectorySort(state, "followers");
    assert.deepEqual(state, { sort: "followers", direction: "asc" });
    state = cycleCreatorDirectorySort(state, "followers");
    assert.deepEqual(state, { sort: "followers", direction: "desc" });
    state = cycleCreatorDirectorySort(state, "followers");
    assert.deepEqual(state, { sort: null, direction: null });
  });

  it("starts ascending when switching columns", () => {
    let state = cycleCreatorDirectorySort(
      { sort: null, direction: null },
      "followers"
    );
    state = cycleCreatorDirectorySort(state, "name");
    assert.deepEqual(state, { sort: "name", direction: "asc" });
  });
});

describe("sortCreatorDirectoryRows", () => {
  const growth = new Map<string, CreatorGrowth>([
    [
      "a",
      { currentFollowers: 100, absoluteGrowth: 10, growthPercentage: 10 },
    ],
    [
      "b",
      { currentFollowers: 500, absoluteGrowth: -5, growthPercentage: -1 },
    ],
    [
      "c",
      { currentFollowers: 250, absoluteGrowth: null, growthPercentage: null },
    ],
  ]);

  it("sorts followers ascending and descending using numeric values", () => {
    const rows = [
      makeCreator({ id: "a", follower_count: 100 }),
      makeCreator({ id: "b", follower_count: 500 }),
      makeCreator({ id: "c", follower_count: 250 }),
    ];

    assert.deepEqual(
      ids(
        sortCreatorDirectoryRows(rows, growth, {
          sort: "followers",
          direction: "asc",
        })
      ),
      ["a", "c", "b"]
    );
    assert.deepEqual(
      ids(
        sortCreatorDirectoryRows(rows, growth, {
          sort: "followers",
          direction: "desc",
        })
      ),
      ["b", "c", "a"]
    );
  });

  it("uses category business order and keeps null last when descending", () => {
    const rows = [
      makeCreator({ id: "mega", category: "mega" }),
      makeCreator({ id: "null", category: null }),
      makeCreator({ id: "nano", category: "nano" }),
      makeCreator({ id: "micro", category: "micro" }),
      makeCreator({ id: "macro", category: "macro" }),
    ];

    assert.deepEqual(
      ids(
        sortCreatorDirectoryRows(rows, new Map(), {
          sort: "category",
          direction: "asc",
        })
      ),
      ["nano", "micro", "macro", "mega", "null"]
    );
    assert.deepEqual(
      ids(
        sortCreatorDirectoryRows(rows, new Map(), {
          sort: "category",
          direction: "desc",
        })
      ),
      ["mega", "macro", "micro", "nano", "null"]
    );
  });

  it("sorts creator names with Turkish-aware comparison", () => {
    const rows = [
      makeCreator({ id: "1", username: "ceren", display_name: "Ceren" }),
      makeCreator({ id: "2", username: "ali", display_name: "Ali" }),
      makeCreator({ id: "3", username: "zeynep", display_name: "İpek" }),
      makeCreator({ id: "4", username: "burak", display_name: "Burak" }),
    ];

    assert.deepEqual(
      ids(
        sortCreatorDirectoryRows(rows, new Map(), {
          sort: "name",
          direction: "asc",
        })
      ),
      ["2", "4", "1", "3"]
    );
  });

  it("sorts growth and keeps unavailable values last", () => {
    const rows = [
      makeCreator({ id: "a" }),
      makeCreator({ id: "b" }),
      makeCreator({ id: "c" }),
    ];

    assert.deepEqual(
      ids(
        sortCreatorDirectoryRows(rows, growth, {
          sort: "growth",
          direction: "asc",
        })
      ),
      ["b", "a", "c"]
    );
    assert.deepEqual(
      ids(
        sortCreatorDirectoryRows(rows, growth, {
          sort: "growth",
          direction: "desc",
        })
      ),
      ["a", "b", "c"]
    );
  });

  it("sorts sync timestamps oldest/newest with never-synced last", () => {
    const rows = [
      makeCreator({
        id: "new",
        last_synced_at: "2026-06-01T00:00:00.000Z",
      }),
      makeCreator({ id: "never", last_synced_at: null }),
      makeCreator({
        id: "old",
        last_synced_at: "2026-01-01T00:00:00.000Z",
      }),
    ];

    assert.deepEqual(
      ids(
        sortCreatorDirectoryRows(rows, new Map(), {
          sort: "sync",
          direction: "asc",
        })
      ),
      ["old", "new", "never"]
    );
    assert.deepEqual(
      ids(
        sortCreatorDirectoryRows(rows, new Map(), {
          sort: "sync",
          direction: "desc",
        })
      ),
      ["new", "old", "never"]
    );
  });

  it("sorts campaign counts numerically", () => {
    const rows = [
      makeCreator({ id: "a", campaign_count: 2 }),
      makeCreator({ id: "b", campaign_count: 0 }),
      makeCreator({ id: "c", campaign_count: 5 }),
    ];

    assert.deepEqual(
      ids(
        sortCreatorDirectoryRows(rows, new Map(), {
          sort: "campaigns",
          direction: "asc",
        })
      ),
      ["b", "a", "c"]
    );
  });

  it("keeps null followers last and preserves stable order for ties", () => {
    const rows = [
      makeCreator({
        id: "z",
        username: "zeta",
        follower_count: 10,
        created_at: "2026-03-01T00:00:00.000Z",
      }),
      makeCreator({
        id: "a",
        username: "alpha",
        follower_count: 10,
        created_at: "2026-02-01T00:00:00.000Z",
      }),
      makeCreator({
        id: "m",
        username: "missing",
        follower_count: Number.NaN,
        created_at: "2026-01-01T00:00:00.000Z",
      }),
    ];

    const sorted = sortCreatorDirectoryRows(rows, new Map(), {
      sort: "followers",
      direction: "asc",
    });
    assert.deepEqual(ids(sorted), ["a", "z", "m"]);
  });

  it("preserves default input order when no sort is selected", () => {
    const rows = [
      makeCreator({ id: "newest" }),
      makeCreator({ id: "older" }),
      makeCreator({ id: "oldest" }),
    ];
    assert.deepEqual(
      ids(sortCreatorDirectoryRows(rows, new Map(), { sort: null, direction: null })),
      ["newest", "older", "oldest"]
    );
  });

  it("applies sort after an already-filtered input list", () => {
    const filtered = [
      makeCreator({ id: "keep-b", follower_count: 20, category: "micro" }),
      makeCreator({ id: "keep-a", follower_count: 10, category: "micro" }),
    ];
    assert.deepEqual(
      ids(
        sortCreatorDirectoryRows(filtered, new Map(), {
          sort: "followers",
          direction: "asc",
        })
      ),
      ["keep-a", "keep-b"]
    );
  });
});

describe("selection compatibility contracts", () => {
  it("keeps selected ids after reordering visible rows", () => {
    const rows = [
      makeCreator({ id: "a", follower_count: 10 }),
      makeCreator({ id: "b", follower_count: 30 }),
      makeCreator({ id: "c", follower_count: 20 }),
    ];
    let selection = toggleCreatorSelection(createEmptySelection(), "b", true);
    selection = toggleCreatorSelection(selection, "a", true);

    const sorted = sortCreatorDirectoryRows(rows, new Map(), {
      sort: "followers",
      direction: "desc",
    });
    const visibleIds = sorted.map((row) => row.id);

    assert.deepEqual(visibleIds, ["b", "c", "a"]);
    assert.deepEqual(selection.selectedIds.sort(), ["a", "b"]);
    assert.equal(areAllVisibleSelected(selection.selectedIds, visibleIds), false);

    selection = selectVisibleCreators(selection, visibleIds, true);
    assert.equal(areAllVisibleSelected(selection.selectedIds, visibleIds), true);
    assert.deepEqual(selection.selectedIds.sort(), ["a", "b", "c"]);
  });

  it("exposes accessible sort action labels", () => {
    assert.equal(
      creatorDirectorySortButtonLabelTr("followers", {
        sort: null,
        direction: null,
      }),
      "Takipçiye göre artan sırala"
    );
    assert.equal(
      creatorDirectorySortButtonLabelTr("followers", {
        sort: "followers",
        direction: "asc",
      }),
      "Takipçiye göre azalan sırala"
    );
  });

  it("sorting helpers do not mutate selection APIs or store selected ids in URL parsers", () => {
    const sortSource = readFileSync("features/creators/directory-sort.ts", "utf8");
    assert.equal(sortSource.includes("selectedIds"), false);
    assert.equal(sortSource.includes("token"), false);

    const selectionSource = readFileSync(
      "features/creator-lists/selection.ts",
      "utf8"
    );
    assert.match(selectionSource, /selectVisibleCreators/);
    assert.match(selectionSource, /areAllVisibleSelected/);

    const header = readFileSync(
      "features/creators/components/creator-directory-sort-header.tsx",
      "utf8"
    );
    assert.match(header, /aria-sort/);
    assert.match(header, /aria-label/);
  });

  it("row actions remain wired on the directory table", () => {
    const directory = readFileSync(
      "features/creator-lists/components/creator-directory-selection.tsx",
      "utf8"
    );
    assert.match(directory, /SyncCreatorButton/);
    assert.match(directory, /\/creators\/\$\{creator\.id\}/);
    assert.match(directory, /\/creators\/\$\{creator\.id\}\/edit/);
  });
});
