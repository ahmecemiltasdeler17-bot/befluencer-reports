/**
 * Pure helpers for featured MP4 preview pointer/hover decisions.
 * Hybrid devices: prefer pointerType over "touch exists".
 */

export function isFineHoverEnvironment(
  matchMedia: (query: string) => { matches: boolean }
): boolean {
  return (
    matchMedia("(hover: hover)").matches &&
    matchMedia("(pointer: fine)").matches
  );
}

/** Mouse hover-intent preview only when the pointer is a mouse in a hover-capable env. */
export function shouldArmHoverPreview(
  pointerType: string,
  matchMedia: (query: string) => { matches: boolean }
): boolean {
  if (pointerType !== "mouse") return false;
  return isFineHoverEnvironment(matchMedia);
}

/** Prefer explicit tap UI when the primary pointer is coarse or hover is unavailable. */
export function shouldPreferTouchPreviewControl(
  matchMedia: (query: string) => { matches: boolean }
): boolean {
  return !isFineHoverEnvironment(matchMedia);
}
