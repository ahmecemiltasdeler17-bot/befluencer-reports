"use server";

import { revalidatePath } from "next/cache";

import { getCampaignById } from "@/features/campaigns/queries";
import { findExistingTikTokCreators } from "@/features/creator-import/queries";
import { mapWithConcurrency } from "@/features/creator-sync/services/creator-sync-core";
import {
  VIDEO_IMPORT_MESSAGES,
  VIDEO_IMPORT_MAX_URLS,
  VIDEO_IMPORT_PROVIDER_CONCURRENCY,
} from "@/features/video-import/constants";
import {
  buildPreviewRow,
  matchCreatorByIdentity,
  normalizeHandle,
  resolveDuplicateVideoStatus,
} from "@/features/video-import/matching";
import {
  createVideoImportRowKey,
  parseVideoImportUrls,
} from "@/features/video-import/parser";
import {
  createMinimalTikTokCreator,
  ensureCampaignCreatorAssignment,
  findVideosByUrlsOrPlatformIds,
  getCreatorByIdForImport,
  insertCampaignVideoFromImport,
} from "@/features/video-import/queries";
import type {
  ManualCreatorOption,
  VideoImportCommitResult,
  VideoImportCommitRowInput,
  VideoImportCommitRowResult,
  VideoImportCommitSummary,
  VideoImportPreviewResult,
  VideoImportPreviewRow,
} from "@/features/video-import/types";
import { searchCreators } from "@/features/creators/queries";
import { isTikTokSyncConfigured } from "@/lib/env.server";
import { isUuid } from "@/features/pdf/origin";
import {
  TikTokProviderError,
  assertApprovedTikTokUrl,
  buildTikTokProfileUrl,
  createApifyTikTokProvider,
  toTurkishProviderMessage,
} from "@/lib/providers/tiktok";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

async function requireAuth() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);
  if (!auth) {
    return null;
  }
  return { supabase, auth };
}

function sanitizePublicError(error: unknown): string {
  if (error instanceof TikTokProviderError) {
    return toTurkishProviderMessage(error);
  }
  if (error instanceof Error) {
    const message = error.message;
    if (
      message === VIDEO_IMPORT_MESSAGES.not_authenticated ||
      message === VIDEO_IMPORT_MESSAGES.campaign_not_found ||
      message.startsWith("En fazla") ||
      message.includes("yetkiniz yok") ||
      message.includes("Oturum")
    ) {
      return message;
    }
  }
  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}

export async function previewCampaignVideoImportAction(
  campaignId: string,
  text: string
): Promise<VideoImportPreviewResult> {
  try {
    if (!(await requireAuth())) {
      return { error: VIDEO_IMPORT_MESSAGES.not_authenticated };
    }

    if (!isUuid(campaignId)) {
      return { error: VIDEO_IMPORT_MESSAGES.campaign_not_found };
    }

    const campaign = await getCampaignById(campaignId);
    if (!campaign) {
      return { error: VIDEO_IMPORT_MESSAGES.campaign_not_found };
    }

    if (!isTikTokSyncConfigured()) {
      return { error: VIDEO_IMPORT_MESSAGES.sync_not_configured };
    }

    const parsed = parseVideoImportUrls(text);

    if (parsed.truncated) {
      return { error: VIDEO_IMPORT_MESSAGES.batch_limit };
    }

    const invalidRows: VideoImportPreviewRow[] = parsed.invalid.map(
      (item, index) =>
        buildPreviewRow({
          rowKey: `invalid:${index}:${item.originalUrl}`,
          originalUrl: item.originalUrl,
          normalizedUrl: item.originalUrl,
          platformVideoId: null,
          thumbnailUrl: null,
          caption: null,
          publishedAt: null,
          creatorUsername: null,
          creatorDisplayName: null,
          creatorAvatarUrl: null,
          creatorFollowerCount: null,
          creatorProfileUrl: null,
          views: null,
          likes: null,
          comments: null,
          shares: null,
          saves: null,
          matchedCreator: null,
          forcedVideoStatus: "invalid_url",
          forcedMessage: item.message,
        })
    );

    if (parsed.urls.length === 0) {
      return {
        rows: invalidRows,
        urlCount: 0,
        skippedEmptyLines: parsed.skippedEmptyLines,
        dedupedCount: parsed.dedupedCount,
      };
    }

    const provider = createApifyTikTokProvider();

    const fetched = await mapWithConcurrency(
      parsed.urls,
      VIDEO_IMPORT_PROVIDER_CONCURRENCY,
      async (item) => {
        try {
          const metrics = await provider.fetchVideoMetrics(item.normalizedUrl);
          return { item, metrics, error: null as string | null };
        } catch (error) {
          return {
            item,
            metrics: null,
            error: sanitizePublicError(error),
          };
        }
      }
    );

    const usernames = fetched
      .map((row) => normalizeHandle(row.metrics?.creatorUsername))
      .filter((value): value is string => Boolean(value));

    const existingCreators = await findExistingTikTokCreators(usernames);
    const providerUrls = fetched.map((row) => {
      if (row.metrics?.videoUrl) {
        try {
          return assertApprovedTikTokUrl(row.metrics.videoUrl).normalizedUrl;
        } catch {
          return row.item.normalizedUrl;
        }
      }
      return row.item.normalizedUrl;
    });

    const platformIds = fetched
      .map(
        (row) =>
          row.metrics?.platformVideoId ?? row.item.platformVideoId ?? null
      )
      .filter((value): value is string => Boolean(value));

    const existingVideos = await findVideosByUrlsOrPlatformIds({
      urls: Array.from(
        new Set([...parsed.urls.map((u) => u.normalizedUrl), ...providerUrls])
      ),
      platformVideoIds: platformIds,
    });

    const rows: VideoImportPreviewRow[] = fetched.map((row, index) => {
      const rowKey = createVideoImportRowKey(row.item.normalizedUrl, index);

      if (!row.metrics) {
        return buildPreviewRow({
          rowKey,
          originalUrl: row.item.originalUrl,
          normalizedUrl: row.item.normalizedUrl,
          platformVideoId: row.item.platformVideoId,
          thumbnailUrl: null,
          caption: null,
          publishedAt: null,
          creatorUsername: null,
          creatorDisplayName: null,
          creatorAvatarUrl: null,
          creatorFollowerCount: null,
          creatorProfileUrl: null,
          views: null,
          likes: null,
          comments: null,
          shares: null,
          saves: null,
          matchedCreator: null,
          forcedVideoStatus: "provider_empty",
          forcedMessage: row.error || VIDEO_IMPORT_MESSAGES.provider_empty,
        });
      }

      let storeUrl = row.item.normalizedUrl;
      try {
        storeUrl = assertApprovedTikTokUrl(row.metrics.videoUrl).normalizedUrl;
      } catch {
        storeUrl = row.item.normalizedUrl;
      }

      const platformVideoId =
        row.metrics.platformVideoId ?? row.item.platformVideoId;
      const handle = normalizeHandle(row.metrics.creatorUsername);
      const profileUrl = handle ? buildTikTokProfileUrl(handle) : null;
      const matched = matchCreatorByIdentity(
        handle,
        profileUrl,
        existingCreators
      );

      const duplicate = resolveDuplicateVideoStatus(
        campaignId,
        storeUrl,
        platformVideoId,
        existingVideos
      );

      if (duplicate.videoStatus) {
        return buildPreviewRow({
          rowKey,
          originalUrl: row.item.originalUrl,
          normalizedUrl: storeUrl,
          platformVideoId,
          thumbnailUrl: row.metrics.thumbnailUrl,
          caption: row.metrics.caption,
          publishedAt: row.metrics.publishedAt,
          creatorUsername: handle,
          creatorDisplayName: row.metrics.creatorDisplayName,
          creatorAvatarUrl: row.metrics.creatorAvatarUrl,
          creatorFollowerCount: row.metrics.creatorFollowerCount,
          creatorProfileUrl: profileUrl,
          views: row.metrics.views,
          likes: row.metrics.likes,
          comments: row.metrics.comments,
          shares: row.metrics.shares,
          saves: row.metrics.saves,
          matchedCreator: matched,
          forcedVideoStatus: duplicate.videoStatus,
          forcedMessage: duplicate.message,
        });
      }

      return buildPreviewRow({
        rowKey,
        originalUrl: row.item.originalUrl,
        normalizedUrl: storeUrl,
        platformVideoId,
        thumbnailUrl: row.metrics.thumbnailUrl,
        caption: row.metrics.caption,
        publishedAt: row.metrics.publishedAt,
        creatorUsername: handle,
        creatorDisplayName: row.metrics.creatorDisplayName,
        creatorAvatarUrl: row.metrics.creatorAvatarUrl,
        creatorFollowerCount: row.metrics.creatorFollowerCount,
        creatorProfileUrl: profileUrl,
        views: row.metrics.views,
        likes: row.metrics.likes,
        comments: row.metrics.comments,
        shares: row.metrics.shares,
        saves: row.metrics.saves,
        matchedCreator: matched,
      });
    });

    return {
      rows: [...invalidRows, ...rows],
      urlCount: parsed.urls.length,
      skippedEmptyLines: parsed.skippedEmptyLines,
      dedupedCount: parsed.dedupedCount,
    };
  } catch (error) {
    return { error: sanitizePublicError(error) };
  }
}

export async function importCampaignVideosFromUrlsAction(input: {
  campaignId: string;
  rows: VideoImportCommitRowInput[];
}): Promise<VideoImportCommitResult> {
  try {
    if (!(await requireAuth())) {
      return { error: VIDEO_IMPORT_MESSAGES.not_authenticated };
    }

    if (!isUuid(input.campaignId)) {
      return { error: VIDEO_IMPORT_MESSAGES.campaign_not_found };
    }

    const campaign = await getCampaignById(input.campaignId);
    if (!campaign) {
      return { error: VIDEO_IMPORT_MESSAGES.campaign_not_found };
    }

    if (!Array.isArray(input.rows) || input.rows.length === 0) {
      return { error: VIDEO_IMPORT_MESSAGES.nothing_selected };
    }

    if (input.rows.length > VIDEO_IMPORT_MAX_URLS) {
      return { error: VIDEO_IMPORT_MESSAGES.batch_limit };
    }

    const summary: VideoImportCommitSummary = {
      totalSubmitted: input.rows.length,
      addedVideos: 0,
      linkedExistingVideos: 0,
      skippedDuplicates: 0,
      createdCreators: 0,
      matchedCreators: 0,
      failedRows: 0,
    };

    const results: VideoImportCommitRowResult[] = [];

    // Sequential commit for safe creator/video uniqueness; preview already
    // used provider concurrency. Avoid racing duplicate creator inserts.
    for (const row of input.rows) {
      const result = await commitOneRow(input.campaignId, row, summary);
      results.push(result);
    }

    revalidatePath(`/campaigns/${input.campaignId}`);
    revalidatePath(`/campaigns/${input.campaignId}/report`);
    revalidatePath("/creators");

    return { summary, rows: results };
  } catch (error) {
    return { error: sanitizePublicError(error) };
  }
}

async function commitOneRow(
  campaignId: string,
  row: VideoImportCommitRowInput,
  summary: VideoImportCommitSummary
): Promise<VideoImportCommitRowResult> {
  const fail = (message: string): VideoImportCommitRowResult => {
    summary.failedRows += 1;
    return {
      rowKey: row.rowKey,
      normalizedUrl: row.normalizedUrl,
      ok: false,
      outcome: "failed",
      message,
    };
  };

  try {
    let normalizedUrl: string;
    try {
      normalizedUrl = assertApprovedTikTokUrl(row.normalizedUrl).normalizedUrl;
    } catch {
      return fail(VIDEO_IMPORT_MESSAGES.invalid_url);
    }

    const platformVideoId = row.platformVideoId;
    const existingVideos = await findVideosByUrlsOrPlatformIds({
      urls: [normalizedUrl],
      platformVideoIds: platformVideoId ? [platformVideoId] : [],
    });

    const duplicate = resolveDuplicateVideoStatus(
      campaignId,
      normalizedUrl,
      platformVideoId,
      existingVideos
    );

    if (duplicate.videoStatus === "already_in_campaign") {
      summary.skippedDuplicates += 1;
      return {
        rowKey: row.rowKey,
        normalizedUrl,
        ok: true,
        outcome: "already_in_campaign",
        message: VIDEO_IMPORT_MESSAGES.already_in_campaign,
      };
    }

    if (duplicate.videoStatus === "exists_elsewhere") {
      summary.failedRows += 1;
      return {
        rowKey: row.rowKey,
        normalizedUrl,
        ok: false,
        outcome: "exists_elsewhere",
        message: VIDEO_IMPORT_MESSAGES.exists_elsewhere,
      };
    }

    let creatorId = row.manualCreatorId || row.matchedCreatorId;
    let createdCreator = false;
    let matchedCreator = Boolean(row.matchedCreatorId && !row.manualCreatorId);

    if (row.manualCreatorId) {
      if (!isUuid(row.manualCreatorId)) {
        return fail(VIDEO_IMPORT_MESSAGES.manual_required);
      }
      const manual = await getCreatorByIdForImport(row.manualCreatorId);
      if (!manual || manual.platform !== "tiktok") {
        return fail(VIDEO_IMPORT_MESSAGES.manual_required);
      }
      creatorId = manual.id;
      matchedCreator = true;
    } else if (row.matchedCreatorId) {
      if (!isUuid(row.matchedCreatorId)) {
        return fail(VIDEO_IMPORT_MESSAGES.manual_required);
      }
      const existing = await getCreatorByIdForImport(row.matchedCreatorId);
      if (!existing) {
        return fail(VIDEO_IMPORT_MESSAGES.manual_required);
      }
      creatorId = existing.id;
      matchedCreator = true;
    } else {
      const handle = normalizeHandle(row.creatorUsername);
      if (!handle) {
        return fail(VIDEO_IMPORT_MESSAGES.creator_unverified);
      }

      const existing = await findExistingTikTokCreators([handle]);
      const matched = matchCreatorByIdentity(
        handle,
        row.creatorProfileUrl,
        existing
      );

      if (matched) {
        creatorId = matched.id;
        matchedCreator = true;
      } else {
        const created = await createMinimalTikTokCreator({
          username: handle,
          displayName: row.creatorDisplayName,
          profileUrl: row.creatorProfileUrl ?? buildTikTokProfileUrl(handle),
          avatarUrl: row.creatorAvatarUrl,
          followerCount: row.creatorFollowerCount,
        });
        creatorId = created.id;
        createdCreator = true;
      }
    }

    if (!creatorId) {
      return fail(VIDEO_IMPORT_MESSAGES.creator_unverified);
    }

    await ensureCampaignCreatorAssignment(campaignId, creatorId);

    const metrics =
      row.views != null
        ? {
            views: Number(row.views) || 0,
            likes: Number(row.likes) || 0,
            comments: Number(row.comments) || 0,
            shares: Number(row.shares) || 0,
            saves: Number(row.saves) || 0,
          }
        : null;

    const video = await insertCampaignVideoFromImport({
      campaignId,
      creatorId,
      videoUrl: normalizedUrl,
      platformVideoId,
      caption: row.caption,
      thumbnailUrl: row.thumbnailUrl,
      publishedAt: row.publishedAt,
      metrics,
    });

    if (createdCreator) {
      summary.createdCreators += 1;
    }
    if (matchedCreator) {
      summary.matchedCreators += 1;
    }
    summary.addedVideos += 1;

    return {
      rowKey: row.rowKey,
      normalizedUrl,
      ok: true,
      outcome: "added",
      message: VIDEO_IMPORT_MESSAGES.added,
      videoId: video.id,
      creatorId,
      createdCreator,
      matchedCreator,
    };
  } catch (error) {
    const message = sanitizePublicError(error);
    if (
      message.includes("zaten") ||
      (error instanceof Error && error.message.toLowerCase().includes("duplicate"))
    ) {
      summary.skippedDuplicates += 1;
      return {
        rowKey: row.rowKey,
        normalizedUrl: row.normalizedUrl,
        ok: true,
        outcome: "already_in_campaign",
        message: VIDEO_IMPORT_MESSAGES.already_in_campaign,
      };
    }

    return fail(message);
  }
}

export async function searchCreatorsForVideoImportAction(
  query: string
): Promise<{ error?: string; creators?: ManualCreatorOption[] }> {
  try {
    if (!(await requireAuth())) {
      return { error: VIDEO_IMPORT_MESSAGES.not_authenticated };
    }

    const creators = await searchCreators(query);
    return {
      creators: creators
        .filter((creator) => creator.platform === "tiktok")
        .map((creator) => ({
          id: creator.id,
          username: creator.username,
          display_name: creator.display_name,
        })),
    };
  } catch (error) {
    return { error: sanitizePublicError(error) };
  }
}
