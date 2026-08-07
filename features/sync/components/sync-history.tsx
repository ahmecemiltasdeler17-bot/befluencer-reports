import Link from "next/link";

import { SyncStatusBadge } from "@/features/sync/components/sync-status-badge";
import type { SyncJobWithRelations } from "@/features/sync/types";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatJobType(jobType: string): string {
  if (jobType === "tiktok_video_sync") {
    return "TikTok video";
  }

  if (jobType === "tiktok_creator_sync") {
    return "TikTok profil";
  }

  if (jobType === "tiktok_sound_sync") {
    return "TikTok ses";
  }

  return jobType;
}

export function SyncHistory({
  campaignId,
  jobs,
}: {
  campaignId: string;
  jobs: SyncJobWithRelations[];
}) {
  if (jobs.length === 0) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <h2 className="text-base font-medium text-white">Senkron Geçmişi</h2>
        <p className="mt-3 text-sm text-zinc-500">
          Henüz senkron kaydı yok. TikTok videolarını güncellediğinizde işlemler
          burada listelenir.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
      <h2 className="text-base font-medium text-white">Senkron Geçmişi</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Son {jobs.length} senkron işlemi
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-950/40">
            <tr className="text-left text-zinc-400">
              <th className="px-3 py-3 font-medium">Video / Üretici</th>
              <th className="px-3 py-3 font-medium">Tür</th>
              <th className="px-3 py-3 font-medium">Durum</th>
              <th className="px-3 py-3 font-medium">Başlangıç</th>
              <th className="px-3 py-3 font-medium">Bitiş</th>
              <th className="px-3 py-3 font-medium">Hata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {jobs.map((job) => (
              <tr key={job.id} className="text-zinc-200">
                <td className="px-3 py-3">
                  {job.video ? (
                    <div className="space-y-1">
                      <Link
                        href={`/campaigns/${campaignId}/videos/${job.video.id}`}
                        className="text-orange-400 hover:text-orange-300"
                      >
                        Video
                      </Link>
                      <p className="text-xs text-zinc-500">
                        @
                        {job.video.creator.display_name ??
                          job.video.creator.username}
                      </p>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {formatJobType(job.job_type)}
                </td>
                <td className="px-3 py-3">
                  <SyncStatusBadge status={job.status} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {formatDateTime(job.started_at)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {formatDateTime(job.completed_at)}
                </td>
                <td className="px-3 py-3 max-w-[220px] truncate text-red-300">
                  {job.error_message ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
