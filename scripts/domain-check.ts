#!/usr/bin/env npx tsx
/**
 * Domain readiness CLI — no secrets printed.
 *
 * Usage:
 *   npm run domain:check
 *   npm run domain:check -- --production
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { runDomainReadinessChecks } from "@/lib/origins/domain-check";

function loadEnvLocal(rootDir: string) {
  const envPath = path.join(rootDir, ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const text = readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
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

function main() {
  const rootDir = process.cwd();
  loadEnvLocal(rootDir);

  const productionFlag = process.argv.includes("--production");
  if (productionFlag) {
    process.env.DOMAIN_CHECK_MODE = "production";
  }

  console.log("BeFluencer — alan adı hazırlık kontrolü");
  console.log("----------------------------------------");
  console.log(
    productionFlag
      ? "Mod: production (localhost reddedilir)"
      : "Mod: yerel/geliştirme (localhost izinli)"
  );
  console.log("");

  const report = runDomainReadinessChecks(process.env, {
    rootDir,
    scanRepo: true,
  });

  for (const item of report.items) {
    const mark =
      item.status === "ok" ? "[OK]" : item.status === "warn" ? "[UYARI]" : "[HATA]";
    console.log(`${mark} ${item.message}`);
  }

  console.log("");
  if (report.ok) {
    console.log("Sonuç: Geçti. Özel alan adı / geçici vercel.app için uygun.");
    process.exit(0);
  }

  console.log(
    "Sonuç: Başarısız. APP_URL / PUBLIC_REPORT_URL değerlerini kontrol edin."
  );
  console.log(
    "İpucu: Gizli anahtarlar yazdırılmaz. Sadece origin değişkenlerini düzeltin."
  );
  process.exit(1);
}

main();
