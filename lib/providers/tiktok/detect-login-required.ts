/**
 * Detects TikTok “login / sensitive content” outcomes from Apify run logs or
 * sparse dataset markers.
 *
 * Apify `run-sync-get-dataset-items` does not return logs. Detection requires a
 * run id + GET /v2/actor-runs/:runId/log (or equivalent). Log text is only the
 * trailing ~5M characters Apify stores, and actor wording can change — treat
 * matches as best-effort, never as proof the video is deleted or malformed.
 */

const LOGIN_REQUIRED_PATTERNS: RegExp[] = [
  /sensitive\s+content/i,
  /require[sd]?\s+login/i,
  /login[-\s]?required/i,
  /not\s+able\s+to\s+see\s+posts\s+that\s+require\s+login/i,
  /posts\s+that\s+require\s+login/i,
  /age[-\s]?restrict/i,
  /login\s+to\s+(?:view|see|watch)/i,
];

/** True when free-text (actor log) indicates anonymous scrape cannot access the post. */
export function detectLoginRequiredFromLog(
  logText: string | null | undefined
): boolean {
  if (!logText || typeof logText !== "string") {
    return false;
  }

  const trimmed = logText.trim();
  if (!trimmed) {
    return false;
  }

  return LOGIN_REQUIRED_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Scans dataset rows for skip/error markers that reference login/sensitive
 * access — without treating a normal empty array as login-required.
 */
export function detectLoginRequiredFromDatasetItems(items: unknown[]): boolean {
  if (!Array.isArray(items) || items.length === 0) {
    return false;
  }

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const fragments = [
      typeof record.error === "string" ? record.error : null,
      typeof record.message === "string" ? record.message : null,
      typeof record.reason === "string" ? record.reason : null,
      typeof record.skippedReason === "string" ? record.skippedReason : null,
      typeof record.skipReason === "string" ? record.skipReason : null,
      typeof record.warning === "string" ? record.warning : null,
    ].filter((value): value is string => Boolean(value));

    for (const fragment of fragments) {
      if (detectLoginRequiredFromLog(fragment)) {
        return true;
      }
    }

    // Compact JSON scan for nested actor payloads (bounded, no PII retention).
    try {
      const serialized = JSON.stringify(record);
      if (serialized.length <= 4_000 && detectLoginRequiredFromLog(serialized)) {
        return true;
      }
    } catch {
      // ignore circular / non-serializable rows
    }
  }

  return false;
}

/**
 * Conservative classifier for SUCCEEDED runs with no usable video item.
 * Returns login_required only when log or dataset markers match; otherwise null
 * so callers keep `empty_result`.
 */
export function classifyEmptySucceededVideoRun(input: {
  logText?: string | null;
  datasetItems?: unknown[];
}): "login_required_content" | null {
  if (detectLoginRequiredFromLog(input.logText)) {
    return "login_required_content";
  }

  if (detectLoginRequiredFromDatasetItems(input.datasetItems ?? [])) {
    return "login_required_content";
  }

  return null;
}
