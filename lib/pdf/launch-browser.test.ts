import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  ChromiumLaunchError,
  closeBrowserQuietly,
  isServerlessRuntime,
  launchBrowser,
  resolveChromiumLaunch,
} from "@/lib/pdf/launch-browser";
import {
  classifyChromiumLaunchCause,
  logPdfExportFailure,
  logPdfLaunchCause,
} from "@/lib/pdf/pdf-export-log";

describe("isServerlessRuntime", () => {
  it("is false locally without Vercel/Lambda env", () => {
    assert.equal(
      isServerlessRuntime({
        NODE_ENV: "development",
      }),
      false
    );
  });

  it("is true on Vercel", () => {
    assert.equal(isServerlessRuntime({ VERCEL: "1" }), true);
    assert.equal(isServerlessRuntime({ VERCEL_ENV: "production" }), true);
  });

  it("is true on AWS Lambda", () => {
    assert.equal(
      isServerlessRuntime({ AWS_LAMBDA_FUNCTION_NAME: "pdf" }),
      true
    );
  });
});

describe("resolveChromiumLaunch", () => {
  it("production/Vercel uses serverless Chromium with headless shell and chromium.args", async () => {
    const chromiumArgs = ["--single-process", "--no-sandbox", "--headless='shell'"];
    let receivedBinDir: string | undefined;

    const resolved = await resolveChromiumLaunch({
      env: { VERCEL: "1" },
      logDiagnostics: false,
      resolveBinDir: () => "/virtual/chromium/bin",
      pathExistsSync: () => true,
      loadServerlessChromium: async () => ({
        args: chromiumArgs,
        executablePath: async (input?: string) => {
          receivedBinDir = input;
          return "/tmp/chromium";
        },
      }),
    });

    assert.equal(resolved.strategy, "serverless-chromium");
    assert.equal(resolved.executablePath, "/tmp/chromium");
    assert.equal(resolved.headless, "shell");
    assert.deepEqual(resolved.args, chromiumArgs);
    assert.equal(receivedBinDir, "/virtual/chromium/bin");
  });

  it("fails when serverless bin pack is missing", async () => {
    await assert.rejects(
      () =>
        resolveChromiumLaunch({
          env: { VERCEL: "1" },
          logDiagnostics: false,
          resolveBinDir: () => null,
          loadServerlessChromium: async () => ({
            args: ["--no-sandbox"],
            executablePath: async () => "/tmp/chromium",
          }),
        }),
      (error: unknown) =>
        error instanceof ChromiumLaunchError &&
        error.code === "CHROMIUM_EXECUTABLE_NOT_FOUND"
    );
  });

  it("fails when resolved executable file is missing", async () => {
    await assert.rejects(
      () =>
        resolveChromiumLaunch({
          env: { VERCEL: "1" },
          logDiagnostics: false,
          resolveBinDir: () => "/virtual/chromium/bin",
          pathExistsSync: () => false,
          loadServerlessChromium: async () => ({
            args: ["--no-sandbox"],
            executablePath: async () => "/tmp/chromium",
          }),
        }),
      (error: unknown) =>
        error instanceof ChromiumLaunchError &&
        error.code === "CHROMIUM_EXECUTABLE_NOT_FOUND" &&
        /does not exist/i.test(error.message)
    );
  });

  it("local path does not use serverless-only assumptions", async () => {
    let serverlessLoaded = false;

    const resolved = await resolveChromiumLaunch({
      env: { NODE_ENV: "development" },
      logDiagnostics: false,
      loadServerlessChromium: async () => {
        serverlessLoaded = true;
        return {
          args: ["--should-not-load"],
          executablePath: async () => "/tmp/chromium",
        };
      },
      findLocalChrome: async () =>
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    });

    assert.equal(serverlessLoaded, false);
    assert.equal(resolved.strategy, "local-chrome");
    assert.equal(resolved.headless, true);
    assert.equal(
      resolved.executablePath,
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    );
  });

  it("prefers CHROME_EXECUTABLE_PATH when set", async () => {
    const configured = path.join(process.cwd(), "package.json");

    const resolved = await resolveChromiumLaunch({
      env: {
        VERCEL: "1",
        CHROME_EXECUTABLE_PATH: configured,
      },
      logDiagnostics: false,
      loadServerlessChromium: async () => {
        throw new Error("should not load serverless when configured");
      },
    });

    assert.equal(resolved.strategy, "configured-executable");
    assert.equal(resolved.headless, true);
    assert.equal(resolved.executablePath, configured);
  });
});

describe("launchBrowser", () => {
  it("production launch receives correct executablePath", async () => {
    const launches: Array<Record<string, unknown>> = [];

    const result = await launchBrowser({
      logDiagnostics: false,
      resolve: async () => ({
        strategy: "serverless-chromium",
        executablePath: "/tmp/chromium",
        args: ["--no-sandbox"],
        headless: "shell",
      }),
      launch: async (options) => {
        launches.push(options as unknown as Record<string, unknown>);
        return {
          close: async () => undefined,
        } as unknown as Awaited<ReturnType<typeof launchBrowser>>["browser"];
      },
    });

    assert.equal(launches.length, 1);
    assert.equal(launches[0]?.executablePath, "/tmp/chromium");
    assert.equal(launches[0]?.headless, "shell");
    assert.deepEqual(launches[0]?.args, ["--no-sandbox"]);
    assert.equal(result.strategy, "serverless-chromium");
  });

  it("wraps launch failures as ChromiumLaunchError", async () => {
    await assert.rejects(
      () =>
        launchBrowser({
          logDiagnostics: false,
          resolve: async () => ({
            strategy: "serverless-chromium",
            executablePath: "/tmp/chromium",
            args: [],
            headless: "shell",
          }),
          launch: async () => {
            throw new Error("Failed to launch the browser process");
          },
        }),
      (error: unknown) =>
        error instanceof ChromiumLaunchError &&
        error.code === "CHROMIUM_LAUNCH_FAILED"
    );
  });
});

describe("diagnostic cause preservation", () => {
  it("classifies common chromium failures into safe phrases", () => {
    assert.equal(
      classifyChromiumLaunchCause("The input directory does not exist"),
      "extraction failure"
    );
    assert.equal(
      classifyChromiumLaunchCause("ENOENT: no such file or directory"),
      "ENOENT"
    );
    assert.equal(
      classifyChromiumLaunchCause("Failed to launch the browser process"),
      "failed to launch browser"
    );
    assert.equal(
      classifyChromiumLaunchCause("error while loading shared libraries: libnss3"),
      "missing shared library"
    );
  });

  it("logs sanitized cause before wrap helper exists", () => {
    const source = readFileSync("features/pdf/services/get-browser.ts", "utf8");
    assert.match(source, /logPdfLaunchCause\(error\)/);
    assert.match(source, /BEFORE wrapping|before wrapping/i);

    // Smoke: helpers do not throw.
    logPdfLaunchCause(new ChromiumLaunchError("CHROMIUM_EXECUTABLE_NOT_FOUND", "ENOENT"));
    logPdfExportFailure("browser-launch", new Error("failed to launch browser"));
  });
});

describe("closeBrowserQuietly", () => {
  it("never throws", async () => {
    await assert.doesNotReject(() =>
      closeBrowserQuietly({
        close: async () => {
          throw new Error("already closed");
        },
      })
    );
  });
});

describe("PDF route contracts", () => {
  it("authenticated PDF route is Node runtime and keeps token cleanup", () => {
    const source = readFileSync(
      "app/api/campaigns/[id]/reports/[versionId]/pdf/route.ts",
      "utf8"
    );
    assert.match(source, /export const runtime = "nodejs"/);
    assert.match(source, /maxDuration = 60/);
    assert.match(source, /invalidateUnusedExportToken/);
    assert.match(source, /logPdfExportStage\("token-created"\)/);
  });

  it("public PDF route is Node runtime and cleans unused tokens", () => {
    const source = readFileSync(
      "app/api/public/reports/[token]/pdf/route.ts",
      "utf8"
    );
    assert.match(source, /export const runtime = "nodejs"/);
    assert.match(source, /invalidateUnusedExportToken/);
  });

  it("next.config traces chromium brotli packs and uses webpack-friendly externals", () => {
    const source = readFileSync("next.config.ts", "utf8");
    assert.match(source, /outputFileTracingIncludes/);
    assert.match(source, /chromium\.br/);
    assert.match(source, /fonts\.tar\.br/);
    assert.match(source, /swiftshader\.tar\.br/);
    assert.match(source, /serverExternalPackages/);
    assert.match(source, /tar-fs/);
  });

  it("package build uses webpack so NFT includes apply", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
      engines?: { node?: string };
    };
    assert.match(pkg.scripts.build, /--webpack/);
    assert.match(pkg.scripts["pdf:diagnose"] ?? "", /pdf-diagnose/);
    assert.equal(pkg.engines?.node, "22.x");
  });

  it("generateReportPdf closes browser in finally and logs stages", () => {
    const source = readFileSync(
      "features/pdf/services/generate-report-pdf.ts",
      "utf8"
    );
    assert.match(source, /finally/);
    assert.match(source, /closeBrowserQuietly/);
    assert.match(source, /logPdfExportStage\("browser-launch"\)/);
    assert.match(source, /logPdfExportStage\("navigate"\)/);
    assert.match(source, /logPdfExportStage\("pdf-render"\)/);
  });

  it("failed launch path burns unused export tokens via consume RPC", () => {
    const source = readFileSync("features/pdf/queries.ts", "utf8");
    assert.match(source, /export async function invalidateUnusedExportToken/);
    assert.match(source, /consume_report_export_token/);
  });
});
