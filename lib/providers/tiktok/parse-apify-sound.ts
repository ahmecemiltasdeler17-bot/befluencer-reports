import { TikTokProviderError } from "@/lib/providers/tiktok/errors";
import { parseProviderCount } from "@/lib/providers/tiktok/parse-provider-count";
import type { TikTokSoundProfile } from "@/lib/providers/tiktok/types";

export type SoundCandidateType =
  | "dedicated_sound"
  | "video_music_meta"
  | "unknown";

type SoundCandidate = {
  index: number;
  type: SoundCandidateType;
  soundId: string | null;
  title: string | null;
  authorName: string | null;
  usageCount: number | null;
  coverUrl: string | null;
  canonicalHint: string | null;
};

export type SoundParseDiagnostics = {
  requestedSoundId: string | null;
  datasetItemCount: number;
  candidateTypes: SoundCandidateType[];
  selectedIndex: number | null;
  selectedType: SoundCandidateType | null;
  parsedUsageCount: number | null;
  errorCode: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(Math.trunc(value));
  }

  const text = asText(value);
  if (!text) {
    return null;
  }

  if (/^\d{8,}$/.test(text)) {
    return text;
  }

  return null;
}

function looksLikeDedicatedSound(item: Record<string, unknown>): boolean {
  if (isRecord(item.musicMeta) || isRecord(item.authorMeta) || item.webVideoUrl) {
    return false;
  }

  // A sound/music object carries music identity without being a video row.
  return Boolean(
    item.musicId ||
      item.soundId ||
      item.musicName ||
      item.soundTitle ||
      item.videoCount ||
      item.usageCount ||
      isRecord(item.music) ||
      isRecord(item.soundStats)
  );
}

function readNested(
  item: Record<string, unknown>,
  ...keys: string[]
): unknown {
  let current: unknown = item;

  for (const key of keys) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

function extractSoundId(item: Record<string, unknown>): string | null {
  return (
    asId(readNested(item, "musicMeta", "musicId")) ??
    asId(readNested(item, "musicMeta", "id")) ??
    asId(readNested(item, "music", "id")) ??
    asId(item.soundId) ??
    asId(item.musicId) ??
    (looksLikeDedicatedSound(item) ? asId(item.id) : null)
  );
}

function extractTitle(item: Record<string, unknown>): string | null {
  return (
    asText(readNested(item, "musicMeta", "musicName")) ??
    asText(readNested(item, "musicMeta", "title")) ??
    asText(readNested(item, "music", "title")) ??
    asText(item.musicName) ??
    asText(item.soundTitle) ??
    (looksLikeDedicatedSound(item) ? asText(item.title) : null)
  );
}

function extractAuthor(item: Record<string, unknown>): string | null {
  return (
    asText(readNested(item, "musicMeta", "musicAuthor")) ??
    asText(readNested(item, "musicMeta", "authorName")) ??
    asText(readNested(item, "music", "authorName")) ??
    asText(readNested(item, "music", "author")) ??
    asText(item.soundAuthor) ??
    asText(item.musicAuthor) ??
    asText(item.authorName)
  );
}

function extractCover(item: Record<string, unknown>): string | null {
  return (
    asText(readNested(item, "musicMeta", "coverMediumUrl")) ??
    asText(readNested(item, "musicMeta", "coverLargeUrl")) ??
    asText(readNested(item, "music", "coverUrl")) ??
    asText(item.coverUrl)
  );
}

/**
 * Explicit total usage fields only. Never playCount/diggCount/shareCount,
 * and never dataset length.
 */
function extractUsageCount(
  item: Record<string, unknown>,
  dedicated: boolean
): number | null {
  const candidates: unknown[] = [
    readNested(item, "musicMeta", "videoCount"),
    readNested(item, "musicMeta", "usageCount"),
    readNested(item, "musicMeta", "totalVideos"),
    readNested(item, "music", "videoCount"),
    readNested(item, "music", "usageCount"),
    readNested(item, "soundStats", "videoCount"),
    readNested(item, "soundStats", "usageCount"),
    // clockworks/tiktok-sound-scraper exposes page total here:
    readNested(item, "searchMusic", "videos"),
    readNested(item, "searchMusic", "videoCount"),
    readNested(item, "searchMusic", "totalVideos"),
    item.usageCount,
  ];

  if (dedicated) {
    candidates.push(item.videoCount);
  }

  for (const candidate of candidates) {
    const parsed = parseProviderCount(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function classifyItem(item: Record<string, unknown>): SoundCandidateType {
  if (looksLikeDedicatedSound(item)) {
    return "dedicated_sound";
  }

  if (isRecord(item.musicMeta) || isRecord(item.searchMusic)) {
    return "video_music_meta";
  }

  return "unknown";
}

function toCandidate(
  item: unknown,
  index: number
): SoundCandidate | null {
  if (!isRecord(item)) {
    return null;
  }

  const type = classifyItem(item);
  if (type === "unknown") {
    return null;
  }

  const dedicated = type === "dedicated_sound";

  return {
    index,
    type,
    soundId: extractSoundId(item),
    title: extractTitle(item),
    authorName: extractAuthor(item),
    usageCount: extractUsageCount(item, dedicated),
    coverUrl: extractCover(item),
    canonicalHint: asText(item.input) ?? asText(readNested(item, "searchMusic", "musicTag")),
  };
}

function idsMatch(left: string | null, right: string | null): boolean {
  return Boolean(left && right && left === right);
}

function canonicalMatches(
  candidate: SoundCandidate,
  requestedCanonicalPath: string | null
): boolean {
  if (!requestedCanonicalPath || !candidate.canonicalHint) {
    return false;
  }

  const hint = candidate.canonicalHint.toLowerCase();
  const path = requestedCanonicalPath.toLowerCase();
  return hint.includes(path.replace(/^\/music\//, "")) || path.includes(hint);
}

/**
 * Selection priority:
 * 1. Dedicated sound with exact id match
 * 2. Dedicated sound when request has no id and canonical URL matches
 * 3. Video row musicMeta with exact id match
 * 4. Otherwise reject
 */
export function selectSoundProfileCandidate(
  items: unknown[],
  requestedSoundId: string | null,
  requestedCanonicalPath: string | null = null
): { candidate: SoundCandidate | null; diagnostics: SoundParseDiagnostics } {
  const candidates = items
    .map((item, index) => toCandidate(item, index))
    .filter((entry): entry is SoundCandidate => entry !== null);

  const diagnostics: SoundParseDiagnostics = {
    requestedSoundId,
    datasetItemCount: items.length,
    candidateTypes: candidates.map((entry) => entry.type),
    selectedIndex: null,
    selectedType: null,
    parsedUsageCount: null,
    errorCode: null,
  };

  const pick = (candidate: SoundCandidate): SoundCandidate => {
    diagnostics.selectedIndex = candidate.index;
    diagnostics.selectedType = candidate.type;
    diagnostics.parsedUsageCount = candidate.usageCount;
    return candidate;
  };

  if (requestedSoundId) {
    const dedicatedMatch = candidates.find(
      (entry) =>
        entry.type === "dedicated_sound" &&
        idsMatch(entry.soundId, requestedSoundId)
    );
    if (dedicatedMatch) {
      return { candidate: pick(dedicatedMatch), diagnostics };
    }

    const videoMatch = candidates.find(
      (entry) =>
        entry.type === "video_music_meta" &&
        idsMatch(entry.soundId, requestedSoundId)
    );
    if (videoMatch) {
      return { candidate: pick(videoMatch), diagnostics };
    }

    const anyOtherId = candidates.some(
      (entry) => entry.soundId && entry.soundId !== requestedSoundId
    );

    diagnostics.errorCode = anyOtherId
      ? "sound_identity_mismatch"
      : "sound_usage_unavailable";
    return { candidate: null, diagnostics };
  }

  const dedicatedCanonical = candidates.find(
    (entry) =>
      entry.type === "dedicated_sound" &&
      canonicalMatches(entry, requestedCanonicalPath)
  );
  if (dedicatedCanonical) {
    return { candidate: pick(dedicatedCanonical), diagnostics };
  }

  diagnostics.errorCode = "sound_usage_unavailable";
  return { candidate: null, diagnostics };
}

function buildCanonicalSoundUrl(
  requestedUrl: string,
  soundId: string,
  title: string | null
): string {
  try {
    const parsed = new URL(requestedUrl);
    if (parsed.pathname.includes("/music/")) {
      return requestedUrl;
    }
  } catch {
    // fall through
  }

  const slugBase = (title ?? "sound")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `https://www.tiktok.com/music/${slugBase || "sound"}-${soundId}`;
}

function logSoundDiagnostics(diagnostics: SoundParseDiagnostics): void {
  if (process.env.TIKTOK_SOUND_SYNC_DEBUG !== "1") {
    return;
  }

  console.info("[tiktok-sound-sync]", {
    requestedSoundId: diagnostics.requestedSoundId,
    datasetItemCount: diagnostics.datasetItemCount,
    candidateTypes: diagnostics.candidateTypes,
    selectedIndex: diagnostics.selectedIndex,
    selectedType: diagnostics.selectedType,
    parsedUsageCount: diagnostics.parsedUsageCount,
    errorCode: diagnostics.errorCode,
  });
}

export function parseApifyTikTokSoundDataset(
  dataset: unknown[],
  input: {
    soundUrl: string;
    soundId?: string | null;
    canonicalPath?: string | null;
  }
): TikTokSoundProfile {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    throw new TikTokProviderError("empty_result");
  }

  const requestedSoundId = input.soundId ?? null;
  const { candidate, diagnostics } = selectSoundProfileCandidate(
    dataset,
    requestedSoundId,
    input.canonicalPath ?? null
  );

  if (!candidate) {
    logSoundDiagnostics(diagnostics);
    if (diagnostics.errorCode === "sound_identity_mismatch") {
      throw new TikTokProviderError("sound_identity_mismatch");
    }
    throw new TikTokProviderError("sound_usage_unavailable");
  }

  if (candidate.usageCount === null) {
    diagnostics.errorCode = "sound_usage_unavailable";
    logSoundDiagnostics(diagnostics);
    throw new TikTokProviderError("sound_usage_unavailable");
  }

  const soundId = candidate.soundId ?? requestedSoundId;

  if (!soundId) {
    diagnostics.errorCode = "malformed_result";
    logSoundDiagnostics(diagnostics);
    throw new TikTokProviderError("malformed_result");
  }

  if (requestedSoundId && soundId !== requestedSoundId) {
    diagnostics.errorCode = "sound_identity_mismatch";
    logSoundDiagnostics(diagnostics);
    throw new TikTokProviderError("sound_identity_mismatch");
  }

  logSoundDiagnostics({
    ...diagnostics,
    parsedUsageCount: candidate.usageCount,
    errorCode: null,
  });

  return {
    soundId,
    soundUrl: buildCanonicalSoundUrl(
      input.soundUrl,
      soundId,
      candidate.title
    ),
    title: candidate.title,
    authorName: candidate.authorName,
    usageCount: candidate.usageCount,
    coverUrl: candidate.coverUrl,
  };
}
