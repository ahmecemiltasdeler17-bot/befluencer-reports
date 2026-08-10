import Link from "next/link";

import { CompactCountText } from "@/components/format/compact-count-text";
import { buttonVariants } from "@/components/ui/button";
import { ArchiveListButton } from "@/features/creator-lists/components/archive-list-button";
import { CreateListShareDialog } from "@/features/creator-lists/components/create-list-share-dialog";
import { ListStatusBadge } from "@/features/creator-lists/components/list-status-badge";
import { listCreatorLists } from "@/features/creator-lists/queries";
import { cn } from "@/lib/utils";

export default async function CreatorListsPage() {
  const lists = await listCreatorLists();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-bf-text">Creator Listeleri</h1>
          <p className="mt-1 text-sm text-bf-steel">
            Seçilmiş creator gruplarını yönetin, dışa aktarın ve paylaşın
          </p>
        </div>
        <Link
          href="/creators"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Dizinden Seç
        </Link>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-lg border border-dashed border-bf-border px-6 py-12 text-center text-sm text-bf-steel">
          Henüz liste yok. Creator dizininden seçim yapıp &quot;Liste Oluştur&quot;
          ile başlayın.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-bf-border">
          <table className="min-w-full divide-y divide-bf-border text-sm">
            <thead className="bg-bf-surface text-left text-bf-steel">
              <tr>
                <th className="px-4 py-2.5 font-medium">Liste</th>
                <th className="px-4 py-2.5 font-medium">Durum</th>
                <th className="px-4 py-2.5 font-medium">Creator</th>
                <th className="px-4 py-2.5 font-medium">Toplam takipçi</th>
                <th className="px-4 py-2.5 font-medium">Ortalama</th>
                <th className="px-4 py-2.5 font-medium">Paylaşım</th>
                <th className="px-4 py-2.5 font-medium">Güncellendi</th>
                <th className="px-4 py-2.5 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bf-border/80 bg-bf-bg/40 text-bf-text/90">
              {lists.map((list) => (
                <tr
                  key={list.id}
                  className="transition-colors hover:bg-primary/[0.04]"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-bf-text">{list.name}</p>
                    {list.description ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-bf-steel">
                        {list.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <ListStatusBadge status={list.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{list.creator_count}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <CompactCountText
                      value={list.total_followers}
                      variant="management"
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {list.average_followers == null ? (
                      "—"
                    ) : (
                      <CompactCountText
                        value={list.average_followers}
                        variant="management"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {list.active_share_count}
                  </td>
                  <td className="px-4 py-3 text-xs text-bf-steel">
                    {new Date(list.updated_at).toLocaleString("tr-TR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/creator-lists/${list.id}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" })
                        )}
                      >
                        Aç
                      </Link>
                      <CreateListShareDialog
                        listId={list.id}
                        disabled={list.status === "archived"}
                      />
                      {list.status !== "archived" ? (
                        <ArchiveListButton listId={list.id} />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
