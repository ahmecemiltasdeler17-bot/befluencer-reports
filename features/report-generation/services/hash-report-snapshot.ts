import { createHash } from "node:crypto";

import type {
  ReportContentSnapshot,
  ReportSnapshot,
} from "@/features/report-generation/schemas";

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      result[key] = sortObjectKeys(record[key]);
    }

    return result;
  }

  return value;
}

/**
 * Canonical hashable shape. Version number, version id and generation time are
 * excluded so that regenerating unchanged data produces the same hash.
 */
function toHashableContent(
  snapshot: ReportContentSnapshot | ReportSnapshot
): unknown {
  const context =
    "reportContext" in snapshot
      ? snapshot.reportContext
      : {
          reportId: snapshot.reportMetadata.reportId,
          reportNumber: snapshot.reportMetadata.reportNumber,
          sourceLastSyncedAt: snapshot.reportMetadata.sourceLastSyncedAt,
        };

  return sortObjectKeys({
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
    reportContext: context,
    sourceCounts: snapshot.sourceCounts,
    data: snapshot.data,
  });
}

export function buildHashableSnapshot(
  snapshot: ReportContentSnapshot | ReportSnapshot
): unknown {
  return toHashableContent(snapshot);
}

export function hashReportSnapshot(
  snapshot: ReportContentSnapshot | ReportSnapshot
): string {
  const canonical = JSON.stringify(toHashableContent(snapshot));
  return createHash("sha256").update(canonical).digest("hex");
}

export function shortContentHash(hash: string): string {
  return hash.slice(0, 8);
}
