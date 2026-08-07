import type { Browser } from "puppeteer-core";

/**
 * Pure browser lifecycle helpers.
 *
 * Kept free of `server-only` and of any Chromium import so they can be unit
 * tested without launching a real browser.
 */

/** Vercel and AWS Lambda both expose these; local development exposes neither. */
export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_LAMBDA_FUNCTION_VERSION ||
      process.env.VERCEL
  );
}

/** Never throws — designed to be called from a finally block. */
export async function closeBrowserQuietly(
  browser: Pick<Browser, "close"> | null | undefined
): Promise<void> {
  if (!browser) {
    return;
  }

  try {
    await browser.close();
  } catch {
    // A browser that already exited is not an export failure.
  }
}
