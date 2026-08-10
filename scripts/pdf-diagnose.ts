/**
 * Safe PDF Chromium packaging diagnostic.
 *
 * Prints only non-secret values: runtime, package versions, asset counts,
 * and whether NFT traces include brotli packs after `npm run build`.
 *
 * Usage: npm run pdf:diagnose
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import {
  countChromiumBrotliAssets,
  resolveServerlessChromiumBinDir,
} from "../lib/pdf/launch-browser";

const require = createRequire(import.meta.url);

function readPkgVersion(name: string): string {
  try {
    const pkgPath = require.resolve(`${name}/package.json`);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    try {
      // package.json may be blocked by exports — fall back to nested require.
      const entry = require.resolve(name);
      const pkgPath = join(dirname(entry), "..", "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
      return pkg.version ?? "unknown";
    } catch {
      return "missing";
    }
  }
}

function findNftFiles(root: string): string[] {
  const hits: string[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) {
      return;
    }

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name.endsWith(".nft.json") && full.includes(`${join("pdf", "route")}`)) {
        hits.push(full);
      }
    }
  }

  walk(root);
  return hits;
}

function countBrInNft(nftPath: string): number {
  try {
    const json = JSON.parse(readFileSync(nftPath, "utf8")) as {
      files?: string[];
    };
    return (json.files ?? []).filter((file) => /\.br$/i.test(file)).length;
  } catch {
    return -1;
  }
}

async function main() {
  const binDir = resolveServerlessChromiumBinDir();
  const compressedAssets = countChromiumBrotliAssets(binDir);

  let chromiumModuleResolved = false;
  try {
    await import("@sparticuz/chromium");
    chromiumModuleResolved = true;
  } catch {
    chromiumModuleResolved = false;
  }

  let executablePathOk = false;
  let executablePathError: string | null = null;

  if (chromiumModuleResolved && binDir) {
    try {
      const chromium = (await import("@sparticuz/chromium")).default;
      // On Windows this may fail (Linux binary) — still useful as package wiring check.
      const path = await chromium.executablePath(binDir);
      executablePathOk = Boolean(path) && existsSync(path);
    } catch (error) {
      executablePathOk = false;
      executablePathError =
        error instanceof Error ? error.name : typeof error === "string" ? error : "Error";
    }
  }

  const nftFiles = findNftFiles(join(process.cwd(), ".next", "server", "app", "api"));
  const nftBrCounts = nftFiles.map((file) => ({
    route: file.includes("public") ? "public-pdf" : "authenticated-pdf",
    brCount: countBrInNft(file),
  }));

  const report = {
    runtime: {
      node: process.version,
      platform: process.platform,
      vercel: Boolean(process.env.VERCEL || process.env.VERCEL_ENV),
    },
    packages: {
      "puppeteer-core": readPkgVersion("puppeteer-core"),
      "@sparticuz/chromium": readPkgVersion("@sparticuz/chromium"),
    },
    chromium: {
      moduleResolved: chromiumModuleResolved,
      binDirFound: Boolean(binDir),
      compressedAssetsDiscovered: compressedAssets,
      expectedCompressedAssets: 4,
      executablePathResolutionSuccess: executablePathOk,
      executablePathErrorName: executablePathError,
    },
    nft: {
      pdfRouteTracesFound: nftFiles.length,
      traces: nftBrCounts,
      note:
        nftFiles.length === 0
          ? "No PDF route NFT traces yet — run npm run build first."
          : nftBrCounts.every((row) => row.brCount >= 3)
            ? "Chromium brotli packs are present in NFT traces."
            : "WARNING: Chromium brotli packs missing from NFT traces. Production launch will fail.",
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (
    nftFiles.length > 0 &&
    nftBrCounts.some((row) => row.brCount < 3)
  ) {
    process.exitCode = 2;
  }
}

void main();
