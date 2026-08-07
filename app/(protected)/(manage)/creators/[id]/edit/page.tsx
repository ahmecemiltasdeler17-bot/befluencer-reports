import Link from "next/link";
import { notFound } from "next/navigation";

import { updateCreator } from "@/features/creators/actions";
import { CreatorForm } from "@/features/creators/components/creator-form";
import { ResetAutoCategoryButton } from "@/features/creators/components/reset-auto-category-button";
import { creatorToFormValues } from "@/features/creators/schemas";
import { getCreatorById } from "@/features/creators/queries";

export default async function EditCreatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = await getCreatorById(id);

  if (!creator) {
    notFound();
  }

  const updateCreatorWithId = updateCreator.bind(null, id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/creators/${creator.id}`}
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← İçerik üreticisine dön
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          İçerik Üreticisini Düzenle
        </h1>
        <p className="mt-1 text-sm text-zinc-400">@{creator.username}</p>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <CreatorForm
          action={updateCreatorWithId}
          defaultValues={creatorToFormValues(creator)}
          submitLabel="Değişiklikleri Kaydet"
          cancelHref={`/creators/${creator.id}`}
        />
        {creator.category_source === "manual" ? (
          <ResetAutoCategoryButton creatorId={creator.id} />
        ) : null}
      </div>
    </div>
  );
}
