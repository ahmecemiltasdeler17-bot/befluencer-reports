import { NextResponse } from "next/server";

import {
  buildCreatorListCsv,
  buildCreatorListCsvFilename,
} from "@/features/creator-lists/calculations";
import { getCreatorList } from "@/features/creator-lists/queries";
import { isUuid } from "@/features/pdf/origin";
import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "Liste bulunamadı." },
      { status: 404, headers: NO_STORE }
    );
  }

  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    return NextResponse.json(
      { error: "Oturum açmanız gerekiyor." },
      { status: 401, headers: NO_STORE }
    );
  }

  try {
    const list = await getCreatorList(id);

    if (!list) {
      return NextResponse.json(
        { error: "Liste bulunamadı." },
        { status: 404, headers: NO_STORE }
      );
    }

    const csv = buildCreatorListCsv(
      list.items.map((item, index) => ({
        position: index + 1,
        username: item.creator.username,
        displayName: item.creator.display_name,
        platform: item.creator.platform,
        category: item.creator.category,
        followerCount: item.creator.follower_count,
        profileUrl: item.creator.profile_url,
        publicNote: item.public_note,
      }))
    );

    const filename = buildCreatorListCsvFilename(list.name);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "CSV oluşturulamadı." },
      { status: 500, headers: NO_STORE }
    );
  }
}
