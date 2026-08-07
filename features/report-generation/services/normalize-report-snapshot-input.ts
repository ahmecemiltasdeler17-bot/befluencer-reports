/**
 * Normalizes report snapshot input into strictly JSON-safe values before Zod
 * validation. It never invents metric values — it only removes `undefined`
 * object properties, converts Dates to ISO strings and rejects value types
 * that cannot survive a JSONB round-trip.
 */
export class ReportSnapshotNormalizationError extends Error {
  readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = "ReportSnapshotNormalizationError";
    this.path = path;
  }
}

function describePath(path: string[]): string {
  return path.length > 0 ? path.join(".") : "snapshot";
}

function normalizeValue(value: unknown, path: string[]): unknown {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ReportSnapshotNormalizationError(
        "Geçersiz tarih değeri.",
        describePath(path)
      );
    }

    return value.toISOString();
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;

    case "number":
      if (!Number.isFinite(value)) {
        throw new ReportSnapshotNormalizationError(
          "Sayısal değer geçerli değil.",
          describePath(path)
        );
      }
      return value;

    case "bigint":
      throw new ReportSnapshotNormalizationError(
        "BigInt değerleri desteklenmiyor.",
        describePath(path)
      );

    case "function":
    case "symbol":
      throw new ReportSnapshotNormalizationError(
        "Serileştirilemeyen değer.",
        describePath(path)
      );

    case "undefined":
      throw new ReportSnapshotNormalizationError(
        "Tanımsız değer.",
        describePath(path)
      );
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (item === undefined) {
        throw new ReportSnapshotNormalizationError(
          "Dizi içinde tanımsız değer.",
          describePath([...path, String(index)])
        );
      }

      return normalizeValue(item, [...path, String(index)]);
    });
  }

  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(record)) {
    const entry = record[key];

    // Drop undefined properties so optional schema fields stay absent
    // instead of becoming explicit undefined values.
    if (entry === undefined) {
      continue;
    }

    result[key] = normalizeValue(entry, [...path, key]);
  }

  return result;
}

export function normalizeReportSnapshotInput(value: unknown): unknown {
  if (value === undefined) {
    throw new ReportSnapshotNormalizationError("Tanımsız değer.", "snapshot");
  }

  return normalizeValue(value, []);
}

/** Guarantees an array for optional display sections without inventing items. */
export function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}
