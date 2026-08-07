/**
 * Fixture shapes inspired by clockworks/tiktok-sound-scraper output.
 * Total usage lives on `searchMusic.videos` — never infer from dataset length.
 */

export const SOUND_ID = "7149523537730997035";
export const OTHER_SOUND_ID = "6889520563052645121";

export function dedicatedSoundObject(overrides: Record<string, unknown> = {}) {
  return {
    id: SOUND_ID,
    musicId: SOUND_ID,
    title: "a negroni sbagliato w prosecco l hbo max",
    musicName: "a negroni sbagliato w prosecco l hbo max",
    authorName: "Max",
    musicAuthor: "Max",
    videoCount: 80_300,
    coverUrl: "https://cdn.example.com/sound-cover.jpg",
    ...overrides,
  };
}

export function videoRowWithMusicMeta(overrides: {
  musicId?: string;
  usage?: string | number;
  playCount?: number;
  diggCount?: number;
} = {}) {
  const musicId = overrides.musicId ?? SOUND_ID;
  const usage = overrides.usage ?? "80.3K";

  return {
    id: "7152967975958498602",
    text: "sample video",
    playCount: overrides.playCount ?? 34_100_000,
    diggCount: overrides.diggCount ?? 2_300_000,
    shareCount: 143_200,
    commentCount: 12_300,
    musicMeta: {
      musicName: "a negroni sbagliato w prosecco l hbo max",
      musicAuthor: "Max",
      musicOriginal: true,
      coverMediumUrl: "https://cdn.example.com/cover-medium.jpg",
      coverLargeUrl: "https://cdn.example.com/cover-large.jpg",
      musicId,
    },
    searchMusic: {
      musicTag: `a-negroni-sbagliato-w-prosecco-l-hbo-max-${musicId}`,
      videos: usage,
    },
    webVideoUrl: "https://www.tiktok.com/@streamonmax/video/7152967975958498602",
  };
}

export function videoRowWrongSound() {
  return videoRowWithMusicMeta({
    musicId: OTHER_SOUND_ID,
    usage: "1.2M",
  });
}

export function videoRowMissingUsage() {
  return {
    id: "7152967975958498602",
    playCount: 1000,
    diggCount: 50,
    musicMeta: {
      musicName: "a negroni sbagliato w prosecco l hbo max",
      musicAuthor: "Max",
      musicId: SOUND_ID,
    },
    // searchMusic omitted deliberately
  };
}

export function videoRowMalformedUsage() {
  return videoRowWithMusicMeta({ usage: "about eighty thousand" });
}

export function videoRowGroupedUsage() {
  return videoRowWithMusicMeta({ usage: "80.300" });
}
