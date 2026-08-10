/**
 * Counts real Apify actor-start HTTP POSTs for one sync operation.
 * Never logs tokens or request bodies.
 */

export type ApifyRunKind = "video" | "creator" | "sound";

export type ApifyRunStartEvent = {
  kind: ApifyRunKind;
  batchSize: number;
  actorId: string;
  /** Creator runs: profiles[] length (never log the usernames). */
  profilesCount?: number;
  /** Creator runs: startUrls[] length (never log the URLs). */
  startUrlsCount?: number;
  expectedBatchSize?: number;
};

export class ApifyRunTracker {
  private starts = 0;
  private readonly events: ApifyRunStartEvent[] = [];

  record(event: ApifyRunStartEvent): void {
    this.starts += 1;
    this.events.push(event);

    const quiet =
      process.env.NODE_TEST === "1" ||
      process.argv.some((arg) => arg === "--test" || arg.endsWith(".test.ts"));

    if (quiet) {
      return;
    }

    if (event.kind === "creator") {
      console.info(
        `[ApifyRunStart] kind=creator expectedBatchSize=${event.expectedBatchSize ?? event.batchSize} profilesCount=${event.profilesCount ?? event.batchSize} startUrlsCount=${event.startUrlsCount ?? "?"} actor=${event.actorId}`
      );
      return;
    }

    console.info(
      `[ApifyRunStart] kind=${event.kind} batchSize=${event.batchSize} actor=${event.actorId}`
    );
  }

  get actorRunsStarted(): number {
    return this.starts;
  }

  getStartEvents(): readonly ApifyRunStartEvent[] {
    return this.events;
  }

  reset(): void {
    this.starts = 0;
    this.events.length = 0;
  }
}

/** Process-local tracker used when no per-operation tracker is injected. */
let defaultTracker: ApifyRunTracker | null = null;

export function getDefaultApifyRunTracker(): ApifyRunTracker {
  if (!defaultTracker) {
    defaultTracker = new ApifyRunTracker();
  }
  return defaultTracker;
}

export function resetDefaultApifyRunTrackerForTests(): void {
  defaultTracker = new ApifyRunTracker();
}
