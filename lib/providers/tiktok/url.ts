import { TikTokProviderError } from "@/lib/providers/tiktok/errors";

const APPROVED_HOSTS = new Set([
  "www.tiktok.com",
  "tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

const VIDEO_ID_PATTERN = /\/video\/(\d+)/;

export type NormalizedTikTokUrl = {
  normalizedUrl: string;
  platformVideoId: string | null;
  isShortUrl: boolean;
};

export function normalizeTikTokVideoUrl(input: string): NormalizedTikTokUrl {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new TikTokProviderError("invalid_url");
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new TikTokProviderError("invalid_url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TikTokProviderError("invalid_url");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (!APPROVED_HOSTS.has(hostname)) {
    throw new TikTokProviderError("invalid_url");
  }

  const isShortUrl = hostname === "vm.tiktok.com" || hostname === "vt.tiktok.com";
  parsed.search = "";
  parsed.hash = "";

  const pathname = parsed.pathname.replace(/\/+$/, "");
  const idMatch = pathname.match(VIDEO_ID_PATTERN);

  return {
    normalizedUrl: parsed.toString(),
    platformVideoId: idMatch?.[1] ?? null,
    isShortUrl,
  };
}

export function assertApprovedTikTokUrl(input: string): NormalizedTikTokUrl {
  return normalizeTikTokVideoUrl(input);
}
