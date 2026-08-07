import { NextResponse } from "next/server";

import {
  PUBLIC_SHARE_UNAVAILABLE_MESSAGE,
  logPublicShareDiagnostics,
} from "@/features/public-reports/errors";
import { consumePublicRateLimit } from "@/features/public-reports/rate-limit";
import { consumePublicReportShareAccess } from "@/features/public-reports/queries";
import { isAccessNonce, isRawShareToken } from "@/features/public-reports/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Records one page open for a public share. POST only — never GET — so link
 * prefetch and crawlers cannot inflate access_count.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!isRawShareToken(token)) {
    return NextResponse.json(
      { error: PUBLIC_SHARE_UNAVAILABLE_MESSAGE },
      { status: 404, headers: NO_STORE }
    );
  }

  const limited = consumePublicRateLimit(`access:${token.slice(0, 16)}`, 30);

  if (!limited.allowed) {
    return NextResponse.json(
      { error: PUBLIC_SHARE_UNAVAILABLE_MESSAGE },
      {
        status: 429,
        headers: {
          ...NO_STORE,
          "Retry-After": String(limited.retryAfterSeconds),
        },
      }
    );
  }

  let nonce: unknown;

  try {
    const body = (await request.json()) as { nonce?: unknown };
    nonce = body.nonce;
  } catch {
    return NextResponse.json(
      { error: PUBLIC_SHARE_UNAVAILABLE_MESSAGE },
      { status: 400, headers: NO_STORE }
    );
  }

  if (typeof nonce !== "string" || !isAccessNonce(nonce)) {
    return NextResponse.json(
      { error: PUBLIC_SHARE_UNAVAILABLE_MESSAGE },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const payload = await consumePublicReportShareAccess(token, nonce);

    if (!payload) {
      return NextResponse.json(
        { error: PUBLIC_SHARE_UNAVAILABLE_MESSAGE },
        { status: 404, headers: NO_STORE }
      );
    }

    return NextResponse.json(
      { ok: true, recorded: Boolean(payload.accessRecorded) },
      { status: 200, headers: NO_STORE }
    );
  } catch (error) {
    logPublicShareDiagnostics("access beacon failed", error);
    return NextResponse.json(
      { error: PUBLIC_SHARE_UNAVAILABLE_MESSAGE },
      { status: 500, headers: NO_STORE }
    );
  }
}
