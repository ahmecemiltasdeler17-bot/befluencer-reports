export interface PosterTheme {
  from: string;
  via: string;
  to: string;
  glow: string;
  accent: string;
}

/** Graphite + cool accents — no orange brand glow. */
const POSTER_THEMES: PosterTheme[] = [
  { from: "#141820", via: "#1a2433", to: "#0c0e12", glow: "#A8D4F0", accent: "#6BA3C7" },
  { from: "#181d26", via: "#1e2a38", to: "#0c0e12", glow: "#C5E4F7", accent: "#7A90A8" },
  { from: "#121820", via: "#1a2836", to: "#0c0e12", glow: "#6BA3C7", accent: "#A8D4F0" },
  { from: "#161c28", via: "#243044", to: "#0c0e12", glow: "#7A90A8", accent: "#C5E4F7" },
  { from: "#10161e", via: "#1c2838", to: "#0c0e12", glow: "#A8D4F0", accent: "#6BA3C7" },
  { from: "#151c26", via: "#223040", to: "#0c0e12", glow: "#C5E4F7", accent: "#7A90A8" },
  { from: "#121820", via: "#1e2c3c", to: "#0c0e12", glow: "#6BA3C7", accent: "#A8D4F0" },
  { from: "#171e28", via: "#253448", to: "#0c0e12", glow: "#7A90A8", accent: "#C5E4F7" },
];

const AVATAR_THEMES: PosterTheme[] = [
  { from: "#181d26", via: "#2a3340", to: "#141820", glow: "#7A90A8", accent: "#A8D4F0" },
  { from: "#1a2433", via: "#2c3a4e", to: "#141820", glow: "#6BA3C7", accent: "#C5E4F7" },
  { from: "#16202c", via: "#283848", to: "#141820", glow: "#A8D4F0", accent: "#7A90A8" },
  { from: "#1c2836", via: "#304050", to: "#141820", glow: "#C5E4F7", accent: "#6BA3C7" },
  { from: "#151c26", via: "#263646", to: "#141820", glow: "#7A90A8", accent: "#A8D4F0" },
  { from: "#1a222e", via: "#2c3848", to: "#141820", glow: "#6BA3C7", accent: "#C5E4F7" },
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

  const trimmed = src.trim();

  // App-relative assets (rare in reports) remain allowed.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return true;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Decides between the real image and the deterministic CSS fallback.
 *
 * `failedSrc` records the exact URL that raised an error. Comparing against it
 * means a URL that already failed is never retried, while a genuinely new URL
 * still gets one attempt — important because provider CDN thumbnail URLs are
 * signed and expire, so failures are permanent for that URL.
 */
export function shouldUseMediaFallback(
  src: string | null | undefined,
  failedSrc: string | null
): boolean {
  if (!isValidImageSrc(src)) {
    return true;
  }

  return failedSrc !== null && failedSrc === src;
}

/**
 * Deterministic decorative waveform heights for the sound identity card.
 * Not measurement data — never display as metrics.
 */
export function generateWaveformBars(seed: string, count = 48): number[] {
  const hash = hashString(seed);
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin((index + (hash % 7)) * 0.45) * 0.35;
    const noise = ((hash >> (index % 12)) & 15) / 30;
    return Math.max(0.12, Math.min(1, 0.35 + wave + noise));
  });
}
