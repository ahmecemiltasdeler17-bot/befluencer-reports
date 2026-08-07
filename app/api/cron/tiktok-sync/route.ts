import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/features/scheduled-sync/cron-auth";
import {
  executeScheduledTikTokSync,
  toPublicScheduledSyncSummary,
} from "@/features/scheduled-sync/services/run-scheduled-tiktok-sync";
import {
  getCronSecret,
  isScheduledSyncConfigured,
} from "@/lib/env.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Highest commonly supported Vercel duration for Pro; Hobby caps lower. */
export const maxDuration = 300;

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Vercel Cron entrypoint. Authenticates solely via CRON_SECRET Bearer token —
 * a browser session is never accepted as a substitute.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!isAuthorizedCronRequest(authorization, getCronSecret())) {
    return jsonResponse({ error: "Yetkisiz istek." }, 401);
  }

  // Ignore any query-string "secret" — never treat it as credentials.
  if (!isScheduledSyncConfigured()) {
    return jsonResponse(
      { error: "Zamanlanmış senkronizasyon yapılandırılmamış." },
      503
    );
  }

  try {
    const summary = await executeScheduledTikTokSync({
      triggeredBy: "cron",
      maxDurationMs: maxDuration * 1000,
    });

    return jsonResponse(toPublicScheduledSyncSummary(summary), 200);
  } catch {
    return jsonResponse(
      { error: "Zamanlanmış senkronizasyon başarısız oldu." },
      500
    );
  }
}
