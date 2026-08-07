import type { CreatorGrowth } from "@/features/creator-sync/queries";
import type {
  CreatorCategory,
  CreatorWithCampaignCount,
} from "@/features/creators/types";

/** Allowlisted creator-directory sort keys (URL `sort=`). */
export const CREATOR_DIRECTORY_SORT_KEYS = [
  "name",
  "category",
  "followers",
  "growth",
  "sync",
  "campaigns",
] as const;

export type CreatorDirectorySortKey =
  (typeof CREATOR_DIRECTORY_SORT_KEYS)[number];

export type CreatorDirectorySortDirection = "asc" | "desc";

export type CreatorDirectorySortState = {
  sort: CreatorDirectorySortKey | null;
  direction: CreatorDirectorySortDirection | null;
};

/**
 * Business order for category ascending.
 * `template` sits after auto tiers; null/uncategorized is always last.
 */
export const CREATOR_CATEGORY_SORT_ORDER: Array<CreatorCategory | null> = [
  "nano",
  "micro",
  "macro",
  "mega",
  "template",
  null,
];

const CATEGORY_RANK = new Map(
  CREATOR_CATEGORY_SORT_ORDER.map((category, index) => [category, index])
);

const NAME_COLLATOR = new Intl.Collator("tr", {
  sensitivity: "base",
  numeric: true,
});

export function isCreatorDirectorySortKey(
  value: string | null | undefined
): value is CreatorDirectorySortKey {
  return (
    typeof value === "string" &&
    (CREATOR_DIRECTORY_SORT_KEYS as readonly string[]).includes(value)
  );
}

export function parseCreatorDirectorySortState(input: {
  sort?: string | null;
  direction?: string | null;
}): CreatorDirectorySortState {
  if (!isCreatorDirectorySortKey(input.sort)) {
    return { sort: null, direction: null };
  }

  if (input.direction === "asc" || input.direction === "desc") {
    return { sort: input.sort, direction: input.direction };
  }

  // Sort key without a valid direction → safe default ascending.
  return { sort: input.sort, direction: "asc" };
}

/**
 * Cycle: default → asc → desc → default for the same column.
 * Switching columns always starts at ascending.
 */
export function cycleCreatorDirectorySort(
  current: CreatorDirectorySortState,
  column: CreatorDirectorySortKey
): CreatorDirectorySortState {
  if (current.sort !== column || current.direction === null) {
    return { sort: column, direction: "asc" };
  }
  if (current.direction === "asc") {
    return { sort: column, direction: "desc" };
  }
  return { sort: null, direction: null };
}

export function normalizeCreatorSortName(
  creator: Pick<CreatorWithCampaignCount, "username" | "display_name">
): string {
  const display = creator.display_name?.trim();
  const username = creator.username.trim().replace(/^@+/, "");
  return (display || username || "").toLocaleLowerCase("tr-TR");
}

function categoryRank(category: CreatorCategory | null | undefined): number {
  if (category === null || category === undefined) {
    return CATEGORY_RANK.get(null) ?? CREATOR_CATEGORY_SORT_ORDER.length;
  }
  return CATEGORY_RANK.get(category) ?? CREATOR_CATEGORY_SORT_ORDER.length - 1;
}

function compareNullableNumber(
  left: number | null | undefined,
  right: number | null | undefined,
  direction: CreatorDirectorySortDirection
): number {
  const leftMissing = left === null || left === undefined || Number.isNaN(left);
  const rightMissing =
    right === null || right === undefined || Number.isNaN(right);

  if (leftMissing && rightMissing) {
    return 0;
  }
  if (leftMissing) {
    return 1;
  }
  if (rightMissing) {
    return -1;
  }

  const delta = left - right;
  return direction === "asc" ? delta : -delta;
}

function compareNullableTimestamp(
  left: string | null | undefined,
  right: string | null | undefined,
  direction: CreatorDirectorySortDirection
): number {
  const leftMs = left ? Date.parse(left) : Number.NaN;
  const rightMs = right ? Date.parse(right) : Number.NaN;
  const leftMissing = !Number.isFinite(leftMs);
  const rightMissing = !Number.isFinite(rightMs);

  if (leftMissing && rightMissing) {
    return 0;
  }
  if (leftMissing) {
    return 1;
  }
  if (rightMissing) {
    return -1;
  }

  const delta = leftMs - rightMs;
  return direction === "asc" ? delta : -delta;
}

function stableSecondaryCompare(
  left: CreatorWithCampaignCount,
  right: CreatorWithCampaignCount
): number {
  const byName = NAME_COLLATOR.compare(
    normalizeCreatorSortName(left),
    normalizeCreatorSortName(right)
  );
  if (byName !== 0) {
    return byName;
  }
  return left.id.localeCompare(right.id);
}

function compareCreatorsBySortKey(
  left: CreatorWithCampaignCount,
  right: CreatorWithCampaignCount,
  sort: CreatorDirectorySortKey,
  direction: CreatorDirectorySortDirection,
  growthByCreator: Map<string, CreatorGrowth>
): number {
  switch (sort) {
    case "name": {
      const delta = NAME_COLLATOR.compare(
        normalizeCreatorSortName(left),
        normalizeCreatorSortName(right)
      );
      return direction === "asc" ? delta : -delta;
    }
    case "category": {
      const leftRank = categoryRank(left.category);
      const rightRank = categoryRank(right.category);
      const leftNull = left.category === null || left.category === undefined;
      const rightNull = right.category === null || right.category === undefined;

      // Null/uncategorized always last in both directions.
      if (leftNull !== rightNull) {
        return leftNull ? 1 : -1;
      }

      const delta = leftRank - rightRank;
      return direction === "asc" ? delta : -delta;
    }
    case "followers": {
      const leftFollowers =
        growthByCreator.get(left.id)?.currentFollowers ?? left.follower_count;
      const rightFollowers =
        growthByCreator.get(right.id)?.currentFollowers ?? right.follower_count;
      return compareNullableNumber(leftFollowers, rightFollowers, direction);
    }
    case "growth": {
      const leftGrowth = growthByCreator.get(left.id)?.absoluteGrowth ?? null;
      const rightGrowth = growthByCreator.get(right.id)?.absoluteGrowth ?? null;
      return compareNullableNumber(leftGrowth, rightGrowth, direction);
    }
    case "sync": {
      return compareNullableTimestamp(
        left.last_synced_at,
        right.last_synced_at,
        direction
      );
    }
    case "campaigns": {
      return compareNullableNumber(
        left.campaign_count,
        right.campaign_count,
        direction
      );
    }
    default: {
      const _exhaustive: never = sort;
      return _exhaustive;
    }
  }
}

/**
 * Sort a filtered creator list. When sort is null, returns the input order
 * (server default: created_at desc) unchanged aside from a shallow copy.
 */
export function sortCreatorDirectoryRows(
  creators: CreatorWithCampaignCount[],
  growthByCreator: Map<string, CreatorGrowth>,
  state: CreatorDirectorySortState
): CreatorWithCampaignCount[] {
  if (!state.sort || !state.direction) {
    return [...creators];
  }

  const sort = state.sort;
  const direction = state.direction;
  const indexed = creators.map((creator, index) => ({ creator, index }));

  indexed.sort((left, right) => {
    const primary = compareCreatorsBySortKey(
      left.creator,
      right.creator,
      sort,
      direction,
      growthByCreator
    );
    if (primary !== 0) {
      return primary;
    }

    const secondary = stableSecondaryCompare(left.creator, right.creator);
    if (secondary !== 0) {
      return secondary;
    }

    // Preserve original relative order when everything else ties.
    return left.index - right.index;
  });

  return indexed.map((entry) => entry.creator);
}

const CREATOR_DIRECTORY_SORT_LABELS: Record<CreatorDirectorySortKey, string> = {
  name: "İçerik üreticisi",
  category: "Kategori",
  followers: "Takipçi",
  growth: "Büyüme",
  sync: "Senkronizasyon",
  campaigns: "Kampanya",
};

/** Turkish-friendly accessible labels such as “Takipçiye göre artan sırala”. */
export function creatorDirectorySortButtonLabelTr(
  column: CreatorDirectorySortKey,
  current: CreatorDirectorySortState
): string {
  const dative: Record<CreatorDirectorySortKey, string> = {
    name: "İçerik üreticisine",
    category: "Kategoriye",
    followers: "Takipçiye",
    growth: "Büyümeye",
    sync: "Senkronizasyona",
    campaigns: "Kampanyaya",
  };

  const base = dative[column];

  if (current.sort !== column || current.direction === null) {
    return `${base} göre artan sırala`;
  }
  if (current.direction === "asc") {
    return `${base} göre azalan sırala`;
  }
  return `${CREATOR_DIRECTORY_SORT_LABELS[column]} sıralamasını kaldır`;
}

export function ariaSortValue(
  column: CreatorDirectorySortKey,
  current: CreatorDirectorySortState
): "none" | "ascending" | "descending" {
  if (current.sort !== column || !current.direction) {
    return "none";
  }
  return current.direction === "asc" ? "ascending" : "descending";
}
