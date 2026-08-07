import type { AutoCreatorCategory } from "@/features/creators/types";

/**
 * Pure audience-tier mapping from a follower count.
 * Does not round. Missing or sub-1k counts are uncategorized (null).
 */
export function calculateCreatorCategory(
  followerCount: number | null | undefined
): AutoCreatorCategory | null {
  if (followerCount === null || followerCount === undefined) {
    return null;
  }

  if (!Number.isFinite(followerCount)) {
    return null;
  }

  if (followerCount < 1_000) {
    return null;
  }

  if (followerCount < 10_000) {
    return "nano";
  }

  if (followerCount < 100_000) {
    return "micro";
  }

  if (followerCount < 1_000_000) {
    return "macro";
  }

  return "mega";
}
