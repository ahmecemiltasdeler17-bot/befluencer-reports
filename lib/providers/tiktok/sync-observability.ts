/**
 * Internal admin-safe metrics for TikTok sync operations.
 * Never includes tokens or raw provider payloads.
 */

export type SyncProviderMetrics = {
  providerRunsStarted: number;
  entitiesRequested: number;
  entitiesReturned: number;
  skippedFresh: number;
  skippedNonRetriable: number;
  skippedCooldown: number;
  skippedUnavailable: number;
  failed: number;
  success: number;
  durationMs: number;
  /** Estimated actor runs avoided vs 1-entity-per-run baseline. */
  estimatedRunsSaved: number;
};

/** Detailed skip reasons for video campaign plan summaries. */
export type VideoSyncSkipBreakdown = {
  loginRequired: number;
  unavailable: number;
  invalidUrl: number;
  malformed: number;
  otherNonRetriable: number;
  fresh: number;
  cooldown: number;
  archived: number;
};

export function createEmptySyncMetrics(): SyncProviderMetrics {
  return {
    providerRunsStarted: 0,
    entitiesRequested: 0,
    entitiesReturned: 0,
    skippedFresh: 0,
    skippedNonRetriable: 0,
    skippedCooldown: 0,
    skippedUnavailable: 0,
    failed: 0,
    success: 0,
    durationMs: 0,
    estimatedRunsSaved: 0,
  };
}

export function createEmptyVideoSkipBreakdown(): VideoSyncSkipBreakdown {
  return {
    loginRequired: 0,
    unavailable: 0,
    invalidUrl: 0,
    malformed: 0,
    otherNonRetriable: 0,
    fresh: 0,
    cooldown: 0,
    archived: 0,
  };
}

export function bumpNonRetriableSkip(
  breakdown: VideoSyncSkipBreakdown,
  code: string | null | undefined
): void {
  switch (code) {
    case "login_required_content":
      breakdown.loginRequired += 1;
      break;
    case "unavailable_video":
      breakdown.unavailable += 1;
      break;
    case "invalid_url":
      breakdown.invalidUrl += 1;
      break;
    case "malformed_result":
      breakdown.malformed += 1;
      break;
    default:
      breakdown.otherNonRetriable += 1;
      break;
  }
}

export function mergeSyncMetrics(
  a: SyncProviderMetrics,
  b: SyncProviderMetrics
): SyncProviderMetrics {
  return {
    providerRunsStarted: a.providerRunsStarted + b.providerRunsStarted,
    entitiesRequested: a.entitiesRequested + b.entitiesRequested,
    entitiesReturned: a.entitiesReturned + b.entitiesReturned,
    skippedFresh: a.skippedFresh + b.skippedFresh,
    skippedNonRetriable: a.skippedNonRetriable + b.skippedNonRetriable,
    skippedCooldown: a.skippedCooldown + b.skippedCooldown,
    skippedUnavailable: a.skippedUnavailable + b.skippedUnavailable,
    failed: a.failed + b.failed,
    success: a.success + b.success,
    durationMs: a.durationMs + b.durationMs,
    estimatedRunsSaved: a.estimatedRunsSaved + b.estimatedRunsSaved,
  };
}

export function logSyncMetrics(
  operation: string,
  metrics: SyncProviderMetrics
): void {
  console.info(
    JSON.stringify({
      scope: "tiktok_sync_metrics",
      operation,
      ...metrics,
    })
  );
}

/** Safe summarized plan log — no secrets, no URLs, no tokens. */
export function logVideoSyncPlan(input: {
  total: number;
  eligible: number;
  fresh: number;
  cooldown: number;
  nonRetryable: number;
  loginRequired: number;
  unavailable: number;
  invalidUrl: number;
  malformed: number;
  otherNonRetriable: number;
  archived: number;
}): void {
  console.info(
    JSON.stringify({
      scope: "VideoSyncPlan",
      total: input.total,
      fresh: input.fresh,
      eligible: input.eligible,
      nonRetryable: input.nonRetryable,
      cooldown: input.cooldown,
      loginRequired: input.loginRequired,
      unavailable: input.unavailable,
      invalidUrl: input.invalidUrl,
      malformed: input.malformed,
      otherNonRetriable: input.otherNonRetriable,
      archived: input.archived,
    })
  );
}

export function formatVideoSkipBreakdownTurkish(
  breakdown: VideoSyncSkipBreakdown
): string | null {
  const nonRetryableTotal =
    breakdown.loginRequired +
    breakdown.unavailable +
    breakdown.invalidUrl +
    breakdown.malformed +
    breakdown.otherNonRetriable;

  if (nonRetryableTotal <= 0) {
    return null;
  }

  const parts: string[] = [];
  if (breakdown.loginRequired > 0) {
    parts.push(`${breakdown.loginRequired} giriş gerektiren içerik`);
  }
  if (breakdown.unavailable > 0) {
    parts.push(`${breakdown.unavailable} gizli/silinmiş`);
  }
  if (breakdown.invalidUrl > 0) {
    parts.push(`${breakdown.invalidUrl} geçersiz URL`);
  }
  if (breakdown.malformed > 0) {
    parts.push(`${breakdown.malformed} bozuk yanıt`);
  }
  if (breakdown.otherNonRetriable > 0) {
    parts.push(`${breakdown.otherNonRetriable} kalıcı hata`);
  }

  return `${nonRetryableTotal} senkronize edilmeyecek: ${parts.join(", ")}`;
}

export function formatSyncMetricsTurkish(
  metrics: SyncProviderMetrics,
  skipBreakdown?: VideoSyncSkipBreakdown | null
): string {
  const parts = [
    `${metrics.success} güncellendi`,
    `${metrics.skippedFresh + metrics.skippedCooldown} zaten günceldi`,
  ];
  if (metrics.skippedUnavailable > 0) {
    parts.push(
      `${metrics.skippedUnavailable} hesap erişilemiyor / pasif`
    );
  }

  const breakdownText = skipBreakdown
    ? formatVideoSkipBreakdownTurkish(skipBreakdown)
    : null;
  if (breakdownText) {
    parts.push(breakdownText);
  } else if (metrics.skippedNonRetriable > 0) {
    parts.push(`${metrics.skippedNonRetriable} yeniden denenmeyecek`);
  }

  if (metrics.failed > 0) {
    parts.push(`${metrics.failed} başarısız`);
  }
  parts.push(`${metrics.providerRunsStarted} sağlayıcı çalıştırması kullanıldı`);
  if (metrics.estimatedRunsSaved > 0) {
    parts.push(`(~${metrics.estimatedRunsSaved} çalıştırma tasarrufu)`);
  }
  return parts.join(" · ");
}

export type GlobalSyncPlan = {
  totalEntities: number;
  freshSkipped: number;
  staleEligible: number;
  nonRetriable: number;
  skippedUnavailable: number;
  plannedVideoBatches: number;
  plannedCreatorBatches: number;
  plannedSoundRuns: number;
  estimatedProviderRuns: number;
};

export function emptyGlobalSyncPlan(): GlobalSyncPlan {
  return {
    totalEntities: 0,
    freshSkipped: 0,
    staleEligible: 0,
    nonRetriable: 0,
    skippedUnavailable: 0,
    plannedVideoBatches: 0,
    plannedCreatorBatches: 0,
    plannedSoundRuns: 0,
    estimatedProviderRuns: 0,
  };
}

export function formatGlobalSyncPlanTurkish(plan: GlobalSyncPlan): string {
  return [
    `Plan: ${plan.totalEntities} varlık`,
    `${plan.freshSkipped} güncel atlandı`,
    `${plan.staleEligible} senkronize edilecek`,
    plan.skippedUnavailable > 0
      ? `${plan.skippedUnavailable} hesap erişilemiyor / pasif`
      : null,
    plan.nonRetriable > 0
      ? `${plan.nonRetriable} yeniden denenmeyecek`
      : null,
    `${plan.estimatedProviderRuns} sağlayıcı çalıştırması planlandı`,
  ]
    .filter(Boolean)
    .join(" · ");
}
