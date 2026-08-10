import "server-only";

import type { Browser, Page } from "puppeteer-core";

import {
  PDF_MAX_BYTES,
  PDF_PAGE_OPTIONS,
  PDF_RENDER_TIMEOUT_MS,
  PDF_READY_SELECTOR,
  PRINT_ASSET_TIMEOUT_MS,
  PRINT_NAVIGATION_TIMEOUT_MS,
  PRINT_READY_TIMEOUT_MS,
  PRINT_VIEWPORT,
} from "@/features/pdf/constants";
import { ReportPdfError } from "@/features/pdf/errors";
import { isAllowedPrintUrl } from "@/features/pdf/origin";
import {
  closeBrowserQuietly,
  launchBrowser,
} from "@/features/pdf/services/get-browser";
import { decidePrintRequest } from "@/features/pdf/services/print-request-policy";
import type { GeneratedReportPdf } from "@/features/pdf/types";
import {
  logPdfExportFailure,
  logPdfExportStage,
} from "@/lib/pdf/pdf-export-log";

/**
 * Waits for fonts and already-requested images with a bounded timeout.
 * A broken remote image resolves rather than blocking the export.
 */
async function waitForAssets(page: Page): Promise<void> {
  try {
    await page.evaluate(async (timeoutMs: number) => {
      const bounded = <T>(promise: Promise<T>) =>
        Promise.race([
          promise,
          new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
        ]);

      await bounded(document.fonts.ready);

      const images = Array.from(document.images).filter((image) => !image.complete);

      await bounded(
        Promise.all(
          images.map(
            (image) =>
              new Promise<void>((resolve) => {
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), { once: true });
              })
          )
        )
      );
    }, PRINT_ASSET_TIMEOUT_MS);
  } catch {
    // Asset settling is best-effort; the readiness marker is the real gate.
  }
}

async function preparePage(page: Page, appOrigin: string): Promise<void> {
  await page.setViewport(PRINT_VIEWPORT);
  await page.setCacheEnabled(false);
  page.setDefaultTimeout(PRINT_NAVIGATION_TIMEOUT_MS);

  // The dark report design lives in screen styles; print media would invert it.
  await page.emulateMediaType("screen");

  await page.setRequestInterception(true);

  page.on("request", (request) => {
    const decision = decidePrintRequest({
      url: request.url(),
      resourceType: request.resourceType(),
      isNavigationRequest: request.isNavigationRequest(),
      appOrigin,
    });

    if (decision === "continue") {
      void request.continue();
      return;
    }

    void request.abort();
  });
}

async function navigate(page: Page, printUrl: string): Promise<void> {
  try {
    const response = await page.goto(printUrl, {
      waitUntil: "networkidle0",
      timeout: PRINT_NAVIGATION_TIMEOUT_MS,
    });

    if (!response || !response.ok()) {
      throw new ReportPdfError(
        "print_route_timeout",
        `Print route status ${response?.status() ?? "none"}`
      );
    }
  } catch (error) {
    if (error instanceof ReportPdfError) {
      throw error;
    }

    throw new ReportPdfError("print_route_timeout", "Navigation failed");
  }
}

async function waitForReadyMarker(page: Page): Promise<void> {
  try {
    await page.waitForSelector(PDF_READY_SELECTOR, {
      timeout: PRINT_READY_TIMEOUT_MS,
    });
  } catch {
    throw new ReportPdfError("print_ready_timeout", "Readiness marker not found");
  }
}

/**
 * Renders a PDF from the internal print route.
 *
 * The URL must already be built from the trusted application origin — this
 * function re-validates it and never accepts a user-supplied address.
 */
export async function generateReportPdf({
  printUrl,
  appOrigin,
}: {
  printUrl: string;
  appOrigin: string;
}): Promise<GeneratedReportPdf> {
  if (!isAllowedPrintUrl(printUrl, appOrigin)) {
    throw new ReportPdfError("app_origin_invalid", "Print URL is not same-origin");
  }

  let browser: Browser | null = null;
  let stage: "browser-launch" | "browser-launched" | "navigate" | "pdf-render" =
    "browser-launch";

  try {
    logPdfExportStage("browser-launch");
    const launched = await launchBrowser();
    browser = launched.browser;
    stage = "browser-launched";
    logPdfExportStage("browser-launched", { strategy: launched.strategy });

    const page = await browser.newPage();

    await preparePage(page, appOrigin);

    stage = "navigate";
    logPdfExportStage("navigate");
    await navigate(page, printUrl);
    await waitForReadyMarker(page);
    await waitForAssets(page);

    stage = "pdf-render";
    logPdfExportStage("pdf-render");

    let bytes: Uint8Array;

    try {
      bytes = await page.pdf({
        ...PDF_PAGE_OPTIONS,
        // Puppeteer's own header/footer would print the URL and page numbers.
        displayHeaderFooter: false,
        timeout: PDF_RENDER_TIMEOUT_MS,
      });
    } catch {
      throw new ReportPdfError("pdf_generation_failed", "page.pdf failed");
    }

    if (bytes.byteLength === 0) {
      throw new ReportPdfError("pdf_generation_failed", "Empty PDF buffer");
    }

    if (bytes.byteLength > PDF_MAX_BYTES) {
      throw new ReportPdfError(
        "pdf_too_large",
        `size=${bytes.byteLength} limit=${PDF_MAX_BYTES}`
      );
    }

    return { bytes: new Uint8Array(bytes), byteLength: bytes.byteLength };
  } catch (error) {
    logPdfExportFailure(stage, error);
    throw error;
  } finally {
    await closeBrowserQuietly(browser);
  }
}
