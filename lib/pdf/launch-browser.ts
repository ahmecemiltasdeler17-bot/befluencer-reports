import { existsSync } from "node:fs";
import { access, constants } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Browser } from "puppeteer-core";

import {
  logPdfExecutableResolution,
  logPdfLaunchCause,
} from "@/lib/pdf/pdf-export-log";

/**
 * Environment-specific Chromium launch for PDF export.
 *
 * Routes must not branch on executable paths — call launchBrowser() only.
 */

export type ChromiumLaunchStrategy =
  | "configured-executable"
  | "serverless-chromium"
  | "local-chrome";

export type ResolvedChromiumLaunch = {
  strategy: ChromiumLaunchStrategy;
  executablePath: string;
  args: string[];
  /** Serverless Chromium requires "shell"; local Chrome accepts boolean true. */
  headless: boolean | "shell";
};

/** Local-only hardened flags. Production uses chromium.args alone. */
export const PDF_CHROMIUM_BASE_ARGS = [
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
] as const;

/** Compressed assets that must be present next to @sparticuz/chromium. */
export const CHROMIUM_BROTLI_ASSETS = [
  "chromium.br",
  "fonts.tar.br",
  "swiftshader.tar.br",
  "al2023.tar.br",
] as const;

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

export type PdfLaunchEnv = Record<string, string | undefined>;

export function isServerlessRuntime(env: PdfLaunchEnv = process.env): boolean {
  return Boolean(
    env.AWS_LAMBDA_FUNCTION_NAME ||
      env.AWS_LAMBDA_FUNCTION_VERSION ||
      env.VERCEL ||
      env.VERCEL_ENV
  );
}

export function launchEnvironmentLabel(
  env: PdfLaunchEnv = process.env
): "vercel" | "local" {
  return env.VERCEL || env.VERCEL_ENV || env.AWS_LAMBDA_FUNCTION_NAME
    ? "vercel"
    : "local";
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findLocalChromeExecutable(
  platform: NodeJS.Platform = process.platform
): Promise<string | null> {
  for (const candidate of LOCAL_CHROME_CANDIDATES[platform] ?? []) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Resolve the @sparticuz/chromium bin directory without trusting a relocated
 * import.meta.url alone. Turbopack NFT previously copied only the JS entry.
 *
 * Avoid createRequire(@sparticuz/chromium) — it is ESM-only and triggers
 * Next/webpack "import ESM packages" warnings.
 */
export function resolveServerlessChromiumBinDir(): string | null {
  const candidates: string[] = [];

  try {
    const resolve = import.meta.resolve;
    if (typeof resolve === "function") {
      const moduleUrl = resolve("@sparticuz/chromium");
      candidates.push(join(dirname(fileURLToPath(moduleUrl)), "..", "bin"));
    }
  } catch {
    // resolve may be unavailable in some test runners.
  }

  // Vercel / local install layout after outputFileTracingIncludes.
  candidates.push(
    join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin")
  );

  // Relative to this module when the monorepo layout is preserved.
  try {
    candidates.push(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "node_modules",
        "@sparticuz",
        "chromium",
        "bin"
      )
    );
  } catch {
    // import.meta.url unavailable.
  }

  for (const candidate of candidates) {
    if (
      existsSync(candidate) &&
      existsSync(join(candidate, "chromium.br"))
    ) {
      return candidate;
    }
  }

  return null;
}

export function countChromiumBrotliAssets(binDir: string | null): number {
  if (!binDir) {
    return 0;
  }

  return CHROMIUM_BROTLI_ASSETS.filter((name) =>
    existsSync(join(binDir, name))
  ).length;
}

export type ServerlessChromiumModule = {
  args: string[];
  executablePath: (input?: string) => Promise<string>;
};

export type ResolveChromiumLaunchOptions = {
  env?: PdfLaunchEnv;
  loadServerlessChromium?: () => Promise<ServerlessChromiumModule>;
  findLocalChrome?: () => Promise<string | null>;
  resolveBinDir?: () => string | null;
  pathExistsSync?: (path: string) => boolean;
  /** When false, skip console diagnostics (tests). Default true. */
  logDiagnostics?: boolean;
};

export class ChromiumLaunchError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ChromiumLaunchError";
    this.code = code;
  }
}

/**
 * Resolves launch options without starting Chromium.
 */
export async function resolveChromiumLaunch(
  options: ResolveChromiumLaunchOptions = {}
): Promise<ResolvedChromiumLaunch> {
  const env = options.env ?? process.env;
  const exists = options.pathExistsSync ?? existsSync;
  const logDiagnostics = options.logDiagnostics !== false;
  const configured = env.CHROME_EXECUTABLE_PATH?.trim();

  if (configured) {
    if (!(await pathExists(configured))) {
      throw new ChromiumLaunchError(
        "CHROMIUM_EXECUTABLE_NOT_FOUND",
        "CHROME_EXECUTABLE_PATH is not available"
      );
    }

    if (logDiagnostics) {
      logPdfExecutableResolution({
        environment: launchEnvironmentLabel(env),
        chromiumPackageLoaded: false,
        executablePathResolved: true,
        executableExists: true,
        executableBasename: basename(configured),
      });
    }

    return {
      strategy: "configured-executable",
      executablePath: configured,
      args: [...PDF_CHROMIUM_BASE_ARGS],
      headless: true,
    };
  }

  if (isServerlessRuntime(env)) {
    let chromiumPackageLoaded = false;
    let executablePathResolved = false;
    let executableExists = false;
    let executableBasename: string | null = null;

    try {
      const chromium = options.loadServerlessChromium
        ? await options.loadServerlessChromium()
        : await loadDefaultServerlessChromium();
      chromiumPackageLoaded = true;

      // Optional API — only call if the installed package exposes the setter.
      const maybeGraphics = chromium as {
        setGraphicsMode?: boolean;
      };
      if ("setGraphicsMode" in maybeGraphics) {
        try {
          maybeGraphics.setGraphicsMode = false;
        } catch {
          // Ignore unsupported setter behavior.
        }
      }

      const binDir = (options.resolveBinDir ?? resolveServerlessChromiumBinDir)();
      if (!binDir) {
        throw new ChromiumLaunchError(
          "CHROMIUM_EXECUTABLE_NOT_FOUND",
          "executable path missing: chromium.br pack not found beside @sparticuz/chromium"
        );
      }

      // Pass bin dir explicitly so extraction does not rely on a relocated
      // import.meta.url inside a hashed Turbopack stub package.
      const executablePath = await chromium.executablePath(binDir);
      executablePathResolved = Boolean(executablePath);

      if (!executablePath) {
        throw new ChromiumLaunchError(
          "CHROMIUM_EXECUTABLE_NOT_FOUND",
          "executable path missing: chromium.executablePath returned empty"
        );
      }

      executableExists = exists(executablePath);
      executableBasename = basename(executablePath);

      if (logDiagnostics) {
        logPdfExecutableResolution({
          environment: "vercel",
          chromiumPackageLoaded,
          executablePathResolved,
          executableExists,
          executableBasename,
        });
      }

      if (!executableExists) {
        throw new ChromiumLaunchError(
          "CHROMIUM_EXECUTABLE_NOT_FOUND",
          "executable path missing: resolved Chromium binary does not exist on disk"
        );
      }

      return {
        strategy: "serverless-chromium",
        executablePath,
        // Minimal compatible production args — no duplicated local flags.
        args: [...chromium.args],
        headless: "shell",
      };
    } catch (error) {
      if (logDiagnostics) {
        logPdfExecutableResolution({
          environment: "vercel",
          chromiumPackageLoaded,
          executablePathResolved,
          executableExists,
          executableBasename,
        });
        logPdfLaunchCause(error);
      }

      if (error instanceof ChromiumLaunchError) {
        throw error;
      }

      const name = error instanceof Error ? error.name : "Error";
      const message =
        error instanceof Error ? error.message.slice(0, 180) : "unknown";
      throw new ChromiumLaunchError(
        "CHROMIUM_RESOLVE_FAILED",
        `Bundled serverless Chromium unavailable (${name}: ${message})`
      );
    }
  }

  const findLocal = options.findLocalChrome ?? findLocalChromeExecutable;
  const local = await findLocal();

  if (!local) {
    throw new ChromiumLaunchError(
      "CHROMIUM_EXECUTABLE_NOT_FOUND",
      "No local Chrome/Chromium found; set CHROME_EXECUTABLE_PATH"
    );
  }

  if (logDiagnostics) {
    logPdfExecutableResolution({
      environment: "local",
      chromiumPackageLoaded: false,
      executablePathResolved: true,
      executableExists: true,
      executableBasename: basename(local),
    });
  }

  return {
    strategy: "local-chrome",
    executablePath: local,
    args: [...PDF_CHROMIUM_BASE_ARGS],
    headless: true,
  };
}

async function loadDefaultServerlessChromium(): Promise<ServerlessChromiumModule> {
  const mod = await import("@sparticuz/chromium");
  return mod.default as ServerlessChromiumModule;
}

export type LaunchedBrowser = {
  browser: Browser;
  strategy: ChromiumLaunchStrategy;
};

export type LaunchBrowserDeps = {
  resolve?: typeof resolveChromiumLaunch;
  launch?: (options: {
    executablePath: string;
    args: string[];
    headless: boolean | "shell";
  }) => Promise<Browser>;
  logDiagnostics?: boolean;
};

/**
 * Launches a short-lived browser. Callers must always close it in a finally
 * block — no shared/cached instance across requests.
 */
export async function launchBrowser(
  deps: LaunchBrowserDeps = {}
): Promise<LaunchedBrowser> {
  const resolve = deps.resolve ?? resolveChromiumLaunch;
  const resolved = await resolve({
    logDiagnostics: deps.logDiagnostics,
  });

  try {
    const launch =
      deps.launch ??
      (async (options) => {
        const puppeteer = await import("puppeteer-core");
        return puppeteer.launch(options);
      });

    const browser = await launch({
      executablePath: resolved.executablePath,
      args: resolved.args,
      headless: resolved.headless,
    });

    return { browser, strategy: resolved.strategy };
  } catch (error) {
    if (deps.logDiagnostics !== false) {
      logPdfLaunchCause(error);
    }

    if (error instanceof ChromiumLaunchError) {
      throw error;
    }

    const name = error instanceof Error ? error.name : "Error";
    const message =
      error instanceof Error ? error.message.slice(0, 180) : "unknown";
    throw new ChromiumLaunchError(
      "CHROMIUM_LAUNCH_FAILED",
      `failed to launch browser (${name}: ${message})`
    );
  }
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
