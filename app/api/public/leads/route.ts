import { NextResponse } from "next/server";

import { ingestLead } from "@/features/leads/services/ingest-lead";
import { consumePublicRateLimit } from "@/features/public-reports/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

const MAX_BODY_BYTES = 32_768;

/**
 * Marketing-site form ingest.
 *
 * befluencer-web posts here with `Authorization: Bearer <FORM_WEBHOOK_SECRET>`.
 * POST only, never GET, so a crawler or link preview cannot create records.
 * Rate limiting is the same best-effort in-memory guard the public share
 * endpoints use — real protection is the shared secret.
 */
export async function POST(request: Request) {
  const limited = consumePublicRateLimit("leads:ingest", 30);

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Gönderim reddedildi." },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSeconds) },
      }
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Gönderim reddedildi." },
      { status: 413, headers: NO_STORE }
    );
  }

  let body: unknown;

  try {
    const raw = await request.text();

    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Gönderim reddedildi." },
        { status: 413, headers: NO_STORE }
      );
    }

    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Gönderim reddedildi." },
      { status: 400, headers: NO_STORE }
    );
  }

  const result = await ingestLead({
    authorization: request.headers.get("authorization"),
    body,
  });

  if (result.ok) {
    return NextResponse.json(
      { ok: true, id: result.id },
      { status: 201, headers: NO_STORE }
    );
  }

  const status =
    result.code === "unauthorized"
      ? 401
      : result.code === "unconfigured"
        ? 503
        : result.code === "invalid_payload"
          ? 400
          : 500;

  return NextResponse.json(
    { error: result.message },
    { status, headers: NO_STORE }
  );
}
