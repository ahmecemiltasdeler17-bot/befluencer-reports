export const validCompleteItem = {
  id: "7123456789012345678",
  webVideoUrl: "https://www.tiktok.com/@creator/video/7123456789012345678",
  text: "Campaign video caption",
  createTimeISO: "2026-01-15T12:00:00.000Z",
  cover: "https://cdn.example.com/cover.jpg",
  playCount: 150000,
  diggCount: 12000,
  commentCount: 450,
  shareCount: 320,
  collectCount: 890,
  authorMeta: {
    name: "creator",
    nickName: "Creator Display",
    avatar: "https://cdn.example.com/avatar.jpg",
    fans: 250000,
  },
};

export const numericStringItem = {
  videoId: "7123456789012345678",
  url: "https://www.tiktok.com/@creator/video/7123456789012345678",
  caption: "Alt field caption",
  views: "98,765",
  likes: "5432",
  comments: "210",
  shares: "88",
  saves: "42",
  author: {
    uniqueId: "creator",
    nickname: "Creator Alt",
    avatarThumb: "https://cdn.example.com/avatar-alt.jpg",
  },
  authorStats: {
    followerCount: "125000",
  },
};

export const alternateFieldNamesItem = {
  id: "7123456789012345678",
  viewCount: 5000,
  likeCount: 400,
  comments: 25,
  shares: 10,
  favoritesCount: 3,
};

export const missingSavesItem = {
  id: "7123456789012345678",
  playCount: 1000,
  diggCount: 50,
  commentCount: 5,
  shareCount: 2,
};

export const emptyDataset: unknown[] = [];

export const malformedMetricsItem = {
  id: "7123456789012345678",
  playCount: 100,
  diggCount: 10,
};

export const privateDeletedItem = {
  error: "Video is private or unavailable",
  message: "not found",
};

export const fallbackUrl =
  "https://www.tiktok.com/@creator/video/7123456789012345678";

/** Clockworks-shaped item with nested videoMeta covers (precedence fixture). */
export const clockworksVideoMetaItem = {
  id: "7123456789012345678",
  webVideoUrl: "https://www.tiktok.com/@creator/video/7123456789012345678",
  text: "Nested cover fields",
  createTimeISO: "2026-01-15T12:00:00.000Z",
  playCount: 150000,
  diggCount: 12000,
  commentCount: 450,
  shareCount: 320,
  collectCount: 890,
  authorMeta: {
    name: "creator",
    nickName: "Creator Display",
    avatar: "https://cdn.example.com/avatar.jpg",
    fans: 250000,
  },
  musicMeta: {
    coverMedium: "https://cdn.example.com/music-cover.jpg",
  },
  videoMeta: {
    originalCover:
      "https://p16-sign-va.tiktokcdn.com/obj/tos-maliva-p-0068/original.jpeg?x-expires=1&x-signature=abc",
    coverUrl: "https://p16-sign-va.tiktokcdn.com/obj/cover-standard.jpeg",
    coverMedium: "https://p16-sign-va.tiktokcdn.com/obj/cover-medium.jpeg",
    dynamicCover: "https://p16-sign-va.tiktokcdn.com/obj/dynamic.webp",
    coverLarge: "https://p16-sign-va.tiktokcdn.com/obj/cover-large.jpeg",
  },
  cover: "https://cdn.example.com/top-level-cover.jpg",
  dynamicCover: "https://cdn.example.com/top-level-dynamic.webp",
};

/** Only dynamic cover available — still a real media URL. */
export const dynamicCoverOnlyItem = {
  id: "7123456789012345678",
  playCount: 1000,
  diggCount: 50,
  commentCount: 5,
  shareCount: 2,
  collectCount: 1,
  authorMeta: {
    name: "creator",
    avatar: "https://cdn.example.com/avatar.jpg",
  },
  dynamicCover: "https://p16-sign-va.tiktokcdn.com/obj/dynamic-only.webp",
};

/** Avatar and music covers only — must not become video thumbnail. */
export const avatarAndMusicOnlyItem = {
  id: "7123456789012345678",
  playCount: 1000,
  diggCount: 50,
  commentCount: 5,
  shareCount: 2,
  authorMeta: {
    name: "creator",
    avatar: "https://cdn.example.com/avatar.jpg",
  },
  musicMeta: {
    coverLarge: "https://cdn.example.com/music.jpg",
  },
  // Deliberately points cover at the avatar URL (must be rejected).
  cover: "https://cdn.example.com/avatar.jpg",
};

export const unsafeThumbnailSchemesItem = {
  id: "7123456789012345678",
  playCount: 1000,
  diggCount: 50,
  commentCount: 5,
  shareCount: 2,
  cover: "javascript:alert(1)",
  coverUrl: "data:image/png;base64,aaaa",
  thumbnailUrl: "blob:https://example.com/uuid",
  dynamicCover: "/relative/path.jpg",
};
