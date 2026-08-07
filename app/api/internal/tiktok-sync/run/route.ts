import { NextResponse } from "next/server";

import {
  executeScheduledTikTokSync,
  toPublicScheduledSyncSummary,
} from "@/features/scheduled-sync/services/run-scheduled-tiktok-sync";
import { isScheduledSyncConfigured } from "@/lib/env.server";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RATE_LIMIT_WINDOW_MS = 60_000;
let lastManualTriggerAt = 0;

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Authenticated internal trigger. Rejects cron-secret-only access — a verified
 * user session is required. Uses the same orchestrator and lock as cron.
 */
export async function POST() {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    return jsonResponse({ error: "Oturum açmanız gerekiyor." }, 401);
  }

  if (!isScheduledSyncConfigured()) {
    return jsonResponse(
      {
        error:
          "Zamanlanmış senkronizasyon yapılandırılmamış. APIFY_* ve SUPABASE_SERVICE_ROLE_KEY değerlerini kontrol edin.",
      },
      503
    );
  }

  const now = Date.now();
  if (now - lastManualTriggerAt < RATE_LIMIT_WINDOW_MS) {
    return jsonResponse(
      {
        error:
          "Lütfen bir dakika bekleyip tekrar deneyin. Senkronizasyon zaten yakın zamanda başlatıldı.",
      },
      429
    );
  }

  lastManualTriggerAt = now;

  try {
    const summary = await executeScheduledTikTokSync({
      triggeredBy: "manual",
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
