import "server-only";

import { access, constants } from "node:fs/promises";

import type { Browser } from "puppeteer-core";

import { ReportPdfError } from "@/features/pdf/errors";
import { isServerlessRuntime } from "@/features/pdf/services/browser-lifecycle";
import type { ChromiumLaunchStrategy } from "@/features/pdf/types";

export { closeBrowserQuietly } from "@/features/pdf/services/browser-lifecycle";

/** Hardened flags — no extensions, no GPU, no unnecessary permissions. */
const BASE_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-sync",
  "--disable-default-apps",
  "--no-first-run",
  "--no-default-browser-check",
  "--mute-audio",
  "--hide-scrollbars",
];

const LOCAL_CHROME_CANDIDATES: Record<string, string[]> = {
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ],
};

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findLocalChrome(): Promise<string | null> {
  for (const candidate of LOCAL_CHROME_CANDIDATES[process.platform] ?? []) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

type ResolvedExecutable = {
  strategy: ChromiumLaunchStrategy;
  executablePath: string;
  args: string[];
  headless: boolean;
};

/**
 * Resolves a Chromium binary without ever logging the path.
 *
 * Precedence: explicit CHROME_EXECUTABLE_PATH, bundled serverless Chromium on
 * Vercel/Lambda, then a locally installed Chrome or Edge.
 */
async function resolveExecutable(): Promise<ResolvedExecutable> {
  const configured = process.env.CHROME_EXECUTABLE_PATH?.trim();

  if (configured) {
    if (!(await isExecutable(configured))) {
      throw new ReportPdfError(
        "browser_launch_failed",
        "CHROME_EXECUTABLE_PATH is not executable"
      );
    }

    return {
      strategy: "configured-executable",
      executablePath: configured,
      args: BASE_ARGS,
      headless: true,
    };
  }

  if (isServerlessRuntime()) {
    try {
      const chromium = (await import("@sparticuz/chromium")).default;
      const executablePath = await chromium.executablePath();

      if (!executablePath) {
        throw new Error("empty executable path");
      }

      return {
        strategy: "serverless-chromium",
        executablePath,
        args: [...new Set([...chromium.args, ...BASE_ARGS])],
        headless: true,
      };
    } catch {
      throw new ReportPdfError(
        "browser_launch_failed",
        "Bundled serverless Chromium unavailable"
      );
    }
  }

  const local = await findLocalChrome();

  if (!local) {
    throw new ReportPdfError(
      "browser_launch_failed",
      "No local Chrome/Chromium found; set CHROME_EXECUTABLE_PATH"
    );
  }

  return {
    strategy: "local-chrome",
    executablePath: local,
    args: BASE_ARGS,
    headless: true,
  };
}

export type LaunchedBrowser = {
  browser: Browser;
  strategy: ChromiumLaunchStrategy;
};

/**
 * Launches a short-lived browser. Callers must always close it in a finally
 * block — this module intentionally keeps no shared/cached instance so a failed
 * export cannot leak a process into the next request.
 */
export async function launchBrowser(): Promise<LaunchedBrowser> {
  const resolved = await resolveExecutable();

  try {
    const puppeteer = await import("puppeteer-core");

    const browser = await puppeteer.launch({
      executablePath: resolved.executablePath,
      args: resolved.args,
      headless: resolved.headless,
      /** Serverless Chromium ships its own font config; keep defaults elsewhere. */
      defaultViewport: null,
    });

    return { browser, strategy: resolved.strategy };
  } catch (error) {
    if (error instanceof ReportPdfError) {
      throw error;
    }

    throw new ReportPdfError("browser_launch_failed", "puppeteer.launch failed");
  }
}
