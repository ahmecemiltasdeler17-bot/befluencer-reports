import "server-only";

import { ReportPdfError } from "@/features/pdf/errors";
import {
  ChromiumLaunchError,
  closeBrowserQuietly,
  launchBrowser as launchBrowserCore,
  type LaunchedBrowser,
} from "@/lib/pdf/launch-browser";
import { logPdfLaunchCause } from "@/lib/pdf/pdf-export-log";

export { closeBrowserQuietly };
export type { LaunchedBrowser };

/**
 * Feature-layer wrapper: maps low-level launch failures to ReportPdfError.
 * Logs the sanitized original cause BEFORE wrapping so Vercel logs keep it.
 */
export async function launchBrowser(): Promise<LaunchedBrowser> {
  try {
    return await launchBrowserCore();
  } catch (error) {
    if (error instanceof ReportPdfError) {
      throw error;
    }

    // Preserve root cause for production diagnosis before Turkish wrap.
    logPdfLaunchCause(error);

    const detail =
      error instanceof ChromiumLaunchError
        ? `${error.code}: ${error.message}`.slice(0, 200)
        : error instanceof Error
          ? error.message.slice(0, 200)
          : "launch failed";

    throw new ReportPdfError("browser_launch_failed", detail);
  }
}
