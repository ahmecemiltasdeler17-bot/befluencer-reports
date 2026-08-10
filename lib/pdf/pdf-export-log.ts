/**
 * Sanitized PDF export stage logs for production diagnosis.
 *
 * Never logs export tokens, auth secrets, cookies, full filesystem paths,
 * or full protected print URLs.
 */

export type PdfExportStage =
  | "token-created"
  | "browser-launch"
  | "browser-launched"
  | "navigate"
  | "pdf-render"
  | "token-invalidated"
  | "failed";

export type PdfExecutableResolutionLog = {
  environment: "vercel" | "local";
  chromiumPackageLoaded: boolean;
  executablePathResolved: boolean;
  executableExists: boolean;
  executableBasename: string | null;
};

function sanitizeMessage(value: string): string {
  return value
    .replace(/[0-9a-f]{64}/gi, "[redacted-token]")
    .replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]")
    .replace(/[A-Za-z]:\\[^\s"']+/g, "[redacted-path]")
    .replace(/\/(?:tmp|var|home|Users|opt|var\/task)[^\s"']*/g, "[redacted-path]")
    .replace(/node_modules[^\s"']+/g, "[redacted-node-modules]")
    .slice(0, 220);
}

/** Classify raw launch/resolution errors into safe diagnostic phrases. */
export function classifyChromiumLaunchCause(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("chromium_executable_not_found") || lower.includes("executable path missing")) {
    return "executable path missing";
  }
  if (lower.includes("enoent")) {
    return "ENOENT";
  }
  if (lower.includes("permission denied") || lower.includes("eacces")) {
    return "permission denied";
  }
  if (
    lower.includes("shared librar") ||
    lower.includes("libnss") ||
    lower.includes("error while loading shared libraries")
  ) {
    return "missing shared library";
  }
  if (
    lower.includes("extract") ||
    lower.includes("inflate") ||
    lower.includes("brotli") ||
    lower.includes("input directory")
  ) {
    return "extraction failure";
  }
  if (lower.includes("failed to launch") || lower.includes("puppeteer.launch")) {
    return "failed to launch browser";
  }
  if (lower.includes("bundled serverless chromium unavailable")) {
    return "extraction failure";
  }

  return sanitizeMessage(message);
}

export function logPdfExportStage(
  stage: PdfExportStage,
  extras?: {
    strategy?: string;
    errorName?: string;
    errorMessage?: string;
    causeName?: string;
    causeMessage?: string;
  }
): void {
  if (stage === "failed") {
    const name = extras?.errorName ?? "Error";
    const message = sanitizeMessage(extras?.errorMessage ?? "unknown");
    console.error(
      `[PdfExport] stage=failed errorName=${name} message=${message}`
    );
    return;
  }

  const parts = [`[PdfExport] stage=${stage}`];
  if (extras?.strategy) {
    parts.push(`strategy=${extras.strategy}`);
  }
  if (extras?.causeName) {
    parts.push(`causeName=${extras.causeName}`);
  }
  if (extras?.causeMessage) {
    parts.push(`causeMessage=${sanitizeMessage(extras.causeMessage)}`);
  }
  console.info(parts.join(" "));
}

export function logPdfExecutableResolution(
  info: PdfExecutableResolutionLog
): void {
  console.info(
    `[PdfExport] stage=browser-launch environment=${info.environment} chromiumPackageLoaded=${info.chromiumPackageLoaded} executablePathResolved=${info.executablePathResolved} executableExists=${info.executableExists} executableBasename=${info.executableBasename ?? "none"}`
  );
}

export function logPdfExportFailure(
  stage: PdfExportStage,
  error: unknown
): void {
  const name = error instanceof Error ? error.name : "Error";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown";

  const detail =
    error &&
    typeof error === "object" &&
    "detail" in error &&
    typeof (error as { detail?: unknown }).detail === "string"
      ? (error as { detail: string }).detail
      : null;

  const causeMessage = detail
    ? classifyChromiumLaunchCause(detail)
    : classifyChromiumLaunchCause(message);

  console.error(
    `[PdfExport] stage=${stage} errorName=${name} message=${sanitizeMessage(message)} causeName=${name} causeMessage=${causeMessage}`
  );
}

export function logPdfLaunchCause(error: unknown): void {
  const name = error instanceof Error ? error.name : "Error";
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown";

  console.error(
    `[PdfExport] stage=browser-launch causeName=${name} causeMessage=${classifyChromiumLaunchCause(raw)}`
  );
}
