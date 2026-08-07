"use client";

/**
 * @deprecated Prefer `ReportCreatorShowcase` for report heroes.
 * Kept as a thin re-export so any residual imports stay type-compatible.
 */
export type { ShowcaseCreator as CreatorAvatar } from "@/components/report/report-creator-showcase";
export {
  ReportCreatorShowcase as CreatorAvatarStack,
  dedupeShowcaseCreators,
} from "@/components/report/report-creator-showcase";
