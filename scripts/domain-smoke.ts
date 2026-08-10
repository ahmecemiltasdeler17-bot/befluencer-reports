#!/usr/bin/env npx tsx
/**
 * Non-destructive domain smoke checks.
 * Does not write to Supabase and does not need a real share token.
 *
 * Usage:
 *   npm run domain:smoke
 *   npm run domain:smoke -- --app https://app.befluencer.co --reports https://reports.befluencer.co
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { FAKE_SHARE_TOKEN_FOR_CHECKS } from "@/lib/origins/share-url-self-check";
import { tryNormalizeConfiguredOrigin } from "@/lib/origins/validate-origin";

function loadEnvLocal(rootDir: string) {
  const envPath = path.join(rootDir, ".env.local");
  if (!existsSync(envPath)) {
    return;
  }
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function checkUrl(
  label: string,
  url: string,
  expectBodyIncludes?: string[]
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "befluencer-domain-smoke/1.0" },
    });
    const text = await response.text();
    const cache = response.headers.get("cache-control") ?? "";
    let ok = response.status > 0 && response.status < 500;

    if (expectBodyIncludes) {
      ok =
        ok &&
        expectBodyIncludes.every((snippet) =>
          text.toLocaleLowerCase("tr-TR").includes(snippet.toLocaleLowerCase("tr-TR"))
        );
    }

    const mark = ok ? "[OK]" : "[HATA]";
    console.log(
      `${mark} ${label} → HTTP ${response.status}${
        cache ? ` · cache: ${cache}` : ""
      }`
    );
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : "bilinmeyen hata";
    console.log(`[HATA] ${label} → istek başarısız (${message})`);
    return false;
  }
}

async function main() {
  loadEnvLocal(process.cwd());

  const app =
    tryNormalizeConfiguredOrigin(readArg("--app") ?? process.env.APP_URL ?? "") ??
    null;
  const reports =
    tryNormalizeConfiguredOrigin(
      readArg("--reports") ?? process.env.PUBLIC_REPORT_URL ?? process.env.APP_URL ?? ""
    ) ?? null;

  console.log("BeFluencer — canlı alan adı duman testi (salt okunur)");
  console.log("------------------------------------------------------");

  if (!app || !reports) {
    console.log(
      "[HATA] APP_URL / PUBLIC_REPORT_URL gerekli. Örnek: npm run domain:smoke -- --app https://befluencer-reports.vercel.app --reports https://befluencer-reports.vercel.app"
    );
    process.exit(1);
  }

  console.log("Not: Gizli anahtarlar yazdırılmaz. Gerçek paylaşım oluşturulmaz.");
  console.log("");

  const fake = FAKE_SHARE_TOKEN_FOR_CHECKS;
  const results = await Promise.all([
    checkUrl("App origin", `${app}/`),
    checkUrl("Reports origin", `${reports}/`),
    checkUrl("Login sayfası", `${app}/login`, ["giriş", "befluencer"]),
    checkUrl("Sahte rapor paylaşımı", `${reports}/r/${fake}`, [
      "bağlantı kullanılamıyor",
    ]),
    checkUrl("Sahte creator listesi", `${reports}/lists/${fake}`, [
      "liste kullanılamıyor",
    ]),
  ]);

  const ok = results.every(Boolean);
  console.log("");
  console.log(
    ok
      ? "Sonuç: Geçti. Origin’ler yanıt veriyor; sahte token’lar unavailable gösteriyor."
      : "Sonuç: Başarısız. DNS / deploy / env değerlerini kontrol edin."
  );
  process.exit(ok ? 0 : 1);
}

main();
