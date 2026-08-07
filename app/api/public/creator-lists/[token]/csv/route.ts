import { NextResponse } from "next/server";

import {
  buildCreatorListCsv,
  buildCreatorListCsvFilename,
} from "@/features/creator-lists/calculations";
import { PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE } from "@/features/creator-lists/errors";
import { consumePublicCreatorListCsv } from "@/features/creator-lists/queries";
import { isRawShareToken } from "@/features/creator-lists/token";
import { consumePublicRateLimit } from "@/features/public-reports/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  return handleCsv(params);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  return handleCsv(params);
}

async function handleCsv(params: Promise<{ token: string }>) {
  const { token } = await params;

  if (!isRawShareToken(token)) {
    return NextResponse.json(
      { error: PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE },
      { status: 404, headers: NO_STORE }
    );
  }

  const limited = consumePublicRateLimit(`cl-csv:${token.slice(0, 16)}`, 20);

  if (!limited.allowed) {
    return NextResponse.json(
      { error: PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE },
      {
        status: 429,
        headers: {
          ...NO_STORE,
          "Retry-After": String(limited.retryAfterSeconds),
        },
      }
    );
  }

  try {
    const payload = await consumePublicCreatorListCsv(token);

    if (!payload) {
      return NextResponse.json(
        { error: PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE },
        { status: 404, headers: NO_STORE }
      );
    }

    if (!payload.allowCsvDownload) {
      return NextResponse.json(
        { error: PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE },
        { status: 403, headers: NO_STORE }
      );
    }

    const csv = buildCreatorListCsv(
      payload.creators.map((creator, index) => ({
        position: index + 1,
        username: creator.username,
        displayName: creator.display_name,
        platform: String(creator.platform),
        category:
          creator.category == null ? null : String(creator.category),
        followerCount: Number(creator.follower_count),
        profileUrl: creator.profile_url,
        publicNote: creator.public_note,
      }))
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildCreatorListCsvFilename(payload.listName)}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: PUBLIC_CREATOR_LIST_UNAVAILABLE_MESSAGE },
      { status: 500, headers: NO_STORE }
    );
  }
}
