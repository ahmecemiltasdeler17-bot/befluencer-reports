import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  isLocalhostOriginCandidate,
  resolveAppUrlCandidate,
  resolvePublicReportUrlCandidate,
} from "@/lib/origins/candidates";
import {
  expectedPublicShareUrls,
  FAKE_SHARE_TOKEN_FOR_CHECKS,
} from "@/lib/origins/share-url-self-check";
import { tryNormalizeConfiguredOrigin } from "@/lib/origins/validate-origin";

export type DomainCheckStatus = "ok" | "warn" | "fail";

export type DomainCheckItem = {
  id: string;
  status: DomainCheckStatus;
  message: string;
};

export type DomainCheckReport = {
  ok: boolean;
  items: DomainCheckItem[];
};

type EnvSnapshot = {
  APP_URL?: string;
  PUBLIC_REPORT_URL?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
  NODE_ENV?: string;
  DOMAIN_CHECK_MODE?: string;
};

function isProductionLike(env: EnvSnapshot): boolean {
  return (
    env.VERCEL === "1" ||
    env.VERCEL_ENV === "production" ||
    env.NODE_ENV === "production" ||
    env.DOMAIN_CHECK_MODE === "production"
  );
}

function setEnvKey(key: keyof EnvSnapshot, value: string | undefined) {
  const target = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete target[key];
  } else {
    target[key] = value;
  }
}

function withEnvSnapshot<T>(env: EnvSnapshot, run: () => T): T {
  const keys: Array<keyof EnvSnapshot> = [
    "APP_URL",
    "PUBLIC_REPORT_URL",
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
    "NODE_ENV",
    "DOMAIN_CHECK_MODE",
  ];
  const previous: EnvSnapshot = {};
  for (const key of keys) {
    previous[key] = process.env[key];
  }

  try {
    for (const key of keys) {
      setEnvKey(key, env[key]);
    }
    return run();
  } finally {
    for (const key of keys) {
      setEnvKey(key, previous[key]);
    }
  }
}

function scanHardcodedLocalhost(rootDir: string): string[] {
  const hits: string[] = [];
  const ignoreDir = new Set([
    "node_modules",
    ".next",
    ".git",
    "docs",
    "agent-transcripts",
    "terminals",
  ]);

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (ignoreDir.has(entry)) {
        continue;
      }
      const full = path.join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (
        entry.endsWith(".test.ts") ||
        entry.endsWith(".test.tsx") ||
        entry.endsWith(".md")
      ) {
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) {
        continue;
      }
      const source = readFileSync(full, "utf8");
      if (
        !source.includes("http://localhost:3000") &&
        !source.includes("http://127.0.0.1:3000")
      ) {
        continue;
      }
      const relative = path.relative(rootDir, full).replace(/\\/g, "/");
      const allowed =
        relative === "lib/origins/candidates.ts" ||
        relative === "lib/origins/domain-check.ts" ||
        relative === "lib/origins/get-app-origin.ts" ||
        relative === "lib/origins/get-public-report-origin.ts" ||
        relative === "lib/env.server.ts" ||
        relative.startsWith("scripts/");
      if (!allowed) {
        hits.push(relative);
      }
    }
  }

  walk(rootDir);
  return hits;
}

/**
 * Production-domain readiness checks. Never logs secret values — only status.
 */
export function runDomainReadinessChecks(
  env: EnvSnapshot = process.env,
  options: { rootDir?: string; scanRepo?: boolean } = {}
): DomainCheckReport {
  return withEnvSnapshot(env, () => {
    const items: DomainCheckItem[] = [];
    const productionLike = isProductionLike(env);

    const appRaw = resolveAppUrlCandidate();
    const publicRaw = resolvePublicReportUrlCandidate();
    const appOrigin = appRaw ? tryNormalizeConfiguredOrigin(appRaw) : null;
    const publicOrigin = publicRaw
      ? tryNormalizeConfiguredOrigin(publicRaw)
      : null;

    if (!appRaw) {
      items.push({
        id: "app_url_present",
        status: "fail",
        message: "APP_URL bulunamadı (veya güvenli bir yedek yok).",
      });
    } else if (!appOrigin) {
      items.push({
        id: "app_url_valid",
        status: "fail",
        message: "APP_URL geçersiz. Mutlak http(s) origin olmalı.",
      });
    } else {
      items.push({
        id: "app_url_valid",
        status: "ok",
        message: "APP_URL geçerli bir origin olarak çözüldü.",
      });
    }

    if (!publicRaw) {
      items.push({
        id: "public_url_present",
        status: "fail",
        message: "PUBLIC_REPORT_URL bulunamadı (APP_URL yedeği de yok).",
      });
    } else if (!publicOrigin) {
      items.push({
        id: "public_url_valid",
        status: "fail",
        message: "PUBLIC_REPORT_URL geçersiz. Mutlak http(s) origin olmalı.",
      });
    } else {
      items.push({
        id: "public_url_valid",
        status: "ok",
        message: "PUBLIC_REPORT_URL geçerli bir origin olarak çözüldü.",
      });
    }

    if (productionLike) {
      if (appOrigin && isLocalhostOriginCandidate(appOrigin)) {
        items.push({
          id: "app_not_localhost",
          status: "fail",
          message:
            "Üretimde APP_URL localhost olamaz. app.befluencer.co veya vercel.app kullanın.",
        });
      } else if (appOrigin) {
        items.push({
          id: "app_not_localhost",
          status: "ok",
          message: "Üretim APP_URL localhost değil.",
        });
      }

      if (publicOrigin && isLocalhostOriginCandidate(publicOrigin)) {
        items.push({
          id: "public_not_localhost",
          status: "fail",
          message:
            "Üretimde PUBLIC_REPORT_URL localhost olamaz. reports.befluencer.co veya vercel.app kullanın.",
        });
      } else if (publicOrigin) {
        items.push({
          id: "public_not_localhost",
          status: "ok",
          message: "Üretim PUBLIC_REPORT_URL localhost değil.",
        });
      }

      if (appOrigin && !appOrigin.startsWith("https://")) {
        items.push({
          id: "app_https",
          status: "fail",
          message: "Üretimde APP_URL HTTPS olmalıdır.",
        });
      } else if (appOrigin) {
        items.push({
          id: "app_https",
          status: "ok",
          message: "APP_URL HTTPS kullanıyor.",
        });
      }

      if (publicOrigin && !publicOrigin.startsWith("https://")) {
        items.push({
          id: "public_https",
          status: "fail",
          message: "Üretimde PUBLIC_REPORT_URL HTTPS olmalıdır.",
        });
      } else if (publicOrigin) {
        items.push({
          id: "public_https",
          status: "ok",
          message: "PUBLIC_REPORT_URL HTTPS kullanıyor.",
        });
      }
    } else {
      items.push({
        id: "dev_mode",
        status: "ok",
        message: "Geliştirme modu: localhost origin değerlerine izin verilir.",
      });
    }

    if (appOrigin && publicOrigin) {
      const bothCustom =
        appOrigin.includes("app.befluencer.co") &&
        publicOrigin.includes("reports.befluencer.co");
      const bothTemporary =
        appOrigin.includes("befluencer-reports.vercel.app") &&
        publicOrigin.includes("befluencer-reports.vercel.app");
      const bothLocal =
        isLocalhostOriginCandidate(appOrigin) &&
        isLocalhostOriginCandidate(publicOrigin);

      if (bothCustom) {
        items.push({
          id: "origins_distinct",
          status: appOrigin === publicOrigin ? "fail" : "ok",
          message:
            appOrigin === publicOrigin
              ? "Özel alan adlarında APP_URL ve PUBLIC_REPORT_URL farklı olmalıdır."
              : "app.befluencer.co ve reports.befluencer.co ayrı origin olarak ayarlı.",
        });
      } else if (bothTemporary || bothLocal) {
        items.push({
          id: "origins_paired",
          status: "ok",
          message: bothTemporary
            ? "Geçici vercel.app tek-host yapılandırması geçerli."
            : "Yerel tek-host yapılandırması geçerli.",
        });
      } else if (appOrigin !== publicOrigin) {
        items.push({
          id: "origins_distinct",
          status: "ok",
          message: "APP_URL ve PUBLIC_REPORT_URL farklı origin kullanıyor.",
        });
      } else {
        items.push({
          id: "origins_paired",
          status: "warn",
          message:
            "APP_URL ve PUBLIC_REPORT_URL aynı. Geçici tek-host için kabul edilebilir; özel alan adında ayrılmalıdır.",
        });
      }

      const expected = expectedPublicShareUrls(
        publicOrigin,
        FAKE_SHARE_TOKEN_FOR_CHECKS
      );
      const reportOk = expected.report === `${publicOrigin}/r/${FAKE_SHARE_TOKEN_FOR_CHECKS}`;
      const listOk = expected.list === `${publicOrigin}/lists/${FAKE_SHARE_TOKEN_FOR_CHECKS}`;
      items.push({
        id: "share_url_shape",
        status: reportOk && listOk ? "ok" : "fail",
        message:
          reportOk && listOk
            ? "Paylaşım URL şekli doğru: /r/<token> ve /lists/<token>."
            : "Paylaşım URL şekli beklenen PUBLIC_REPORT_URL yollarıyla uyuşmuyor.",
      });
    }

    if (options.scanRepo !== false) {
      const rootDir = options.rootDir ?? process.cwd();
      const localhostHits = scanHardcodedLocalhost(rootDir);
      if (localhostHits.length > 0) {
        items.push({
          id: "hardcoded_localhost",
          status: productionLike ? "fail" : "warn",
          message: `Üretim kodunda sabit localhost bulundu: ${localhostHits
            .slice(0, 8)
            .join(", ")}${localhostHits.length > 8 ? "…" : ""}`,
        });
      } else {
        items.push({
          id: "hardcoded_localhost",
          status: "ok",
          message: "Üretim kaynaklarında sabit localhost paylaşım URL’si yok.",
        });
      }
    }

    return {
      ok: items.every((item) => item.status !== "fail"),
      items,
    };
  });
}
