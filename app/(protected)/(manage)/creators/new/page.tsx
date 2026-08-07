import Link from "next/link";

import { createCreator } from "@/features/creators/actions";
import { CreatorForm } from "@/features/creators/components/creator-form";

export default function NewCreatorPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/creators"
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← İçerik üreticilerine dön
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          Yeni İçerik Üreticisi
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Global havuza yeni bir içerik üreticisi ekleyin.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <CreatorForm
          action={createCreator}
          submitLabel="İçerik Üreticisini Oluştur"
          cancelHref="/creators"
        />
      </div>
    </div>
  );
}
