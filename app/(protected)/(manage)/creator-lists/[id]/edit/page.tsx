import { notFound } from "next/navigation";

import { EditListForm } from "@/features/creator-lists/components/edit-list-form";
import { getCreatorList } from "@/features/creator-lists/queries";

export default async function EditCreatorListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = await getCreatorList(id);

  if (!list) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Listeyi düzenle</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Public açıklama paylaşımda görünür; iç notlar gizli kalır.
        </p>
      </div>
      <EditListForm
        listId={list.id}
        initial={{
          name: list.name,
          description: list.description,
          internal_notes: list.internal_notes,
          status: list.status,
        }}
      />
    </div>
  );
}
