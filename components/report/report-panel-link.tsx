import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getVerifiedAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function ReportPanelLink({ href = "/campaigns" }: { href?: string }) {
  const supabase = await createClient();
  const auth = await getVerifiedAuth(supabase);

  if (!auth) {
    return null;
  }

  return (
    <Link
      href={href}
      className="absolute top-10 right-6 z-10 inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300 print:hidden min-[1100px]:right-12"
    >
      <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
      Panele Dön
    </Link>
  );
}
