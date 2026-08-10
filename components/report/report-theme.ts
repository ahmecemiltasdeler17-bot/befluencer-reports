/**
 * Report visualization theme — mirrors CSS tokens on `.report-canvas`.
 * Used by Recharts (inline stroke/fill) and non-CSS chart accents.
 * Keep in sync with `app/globals.css` report token block.
 */
export const REPORT_THEME = {
  bg: "#0c0e12",
  surface: "#141820",
  surfaceElevated: "#181d26",
  text: "#eef2f7",
  textMuted: "#9aa3b2",
  textFaint: "#6b7380",
  accent: "#A8D4F0",
  accentSoft: "#C5E4F7",
  accentStrong: "#6BA3C7",
  steel: "#7A90A8",
  border: "rgba(122, 144, 168, 0.18)",
  grid: "rgba(122, 144, 168, 0.12)",
  chartPrimary: "#A8D4F0",
  chartFill: "rgba(168, 212, 240, 0.16)",
  chartFillFade: "rgba(168, 212, 240, 0)",
  chartSecondary: "#7A90A8",
  engagement: {
    likes: "#A8D4F0",
    comments: "#7A90A8",
    shares: "#C5E4F7",
    saves: "#6BA3C7",
  },
  positive: "#7dd3a0",
  warning: "#e0c070",
  destructive: "#e07a7a",
} as const;

export type ReportTheme = typeof REPORT_THEME;
