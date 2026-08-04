export interface PosterTheme {
  from: string;
  via: string;
  to: string;
  glow: string;
  accent: string;
}

const POSTER_THEMES: PosterTheme[] = [
  { from: "#1a0a2e", via: "#16213e", to: "#09090B", glow: "#FF5A00", accent: "#7c3aed" },
  { from: "#2d1b4e", via: "#1a1033", to: "#09090B", glow: "#ff7a33", accent: "#ec4899" },
  { from: "#0f2027", via: "#203a43", to: "#09090B", glow: "#FF5A00", accent: "#06b6d4" },
  { from: "#1f1c2c", via: "#928dab", to: "#09090B", glow: "#fb923c", accent: "#818cf8" },
  { from: "#141e30", via: "#243b55", to: "#09090B", glow: "#FF5A00", accent: "#f472b6" },
  { from: "#200122", via: "#6f0000", to: "#09090B", glow: "#ff6b35", accent: "#a78bfa" },
  { from: "#0b132b", via: "#1c2541", to: "#09090B", glow: "#FF5A00", accent: "#22d3ee" },
  { from: "#232526", via: "#414345", to: "#09090B", glow: "#f97316", accent: "#c084fc" },
];

const AVATAR_THEMES: PosterTheme[] = [
  { from: "#27272a", via: "#3f3f46", to: "#18181b", glow: "#52525b", accent: "#a1a1aa" },
  { from: "#1e1b4b", via: "#312e81", to: "#18181b", glow: "#6366f1", accent: "#818cf8" },
  { from: "#431407", via: "#7c2d12", to: "#18181b", glow: "#FF5A00", accent: "#fb923c" },
  { from: "#042f2e", via: "#134e4a", to: "#18181b", glow: "#14b8a6", accent: "#2dd4bf" },
  { from: "#3b0764", via: "#581c87", to: "#18181b", glow: "#a855f7", accent: "#c084fc" },
  { from: "#450a0a", via: "#7f1d1d", to: "#18181b", glow: "#ef4444", accent: "#f87171" },
];

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getPosterTheme(seed: string): PosterTheme {
  return POSTER_THEMES[hashString(seed) % POSTER_THEMES.length];
}

export function getAvatarTheme(seed: string): PosterTheme {
  return AVATAR_THEMES[hashString(seed) % AVATAR_THEMES.length];
}

export function isValidImageSrc(src?: string | null): src is string {
  if (!src || src.trim() === "") return false;
  if (src === "#" || src === "undefined" || src === "null") return false;
  return src.startsWith("http") || src.startsWith("/");
}

export function generateWaveformBars(seed: string, count = 48): number[] {
  const hash = hashString(seed);
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin((index + hash % 7) * 0.45) * 0.35;
    const noise = ((hash >> (index % 12)) & 15) / 30;
    return Math.max(0.12, Math.min(1, 0.35 + wave + noise));
  });
}
