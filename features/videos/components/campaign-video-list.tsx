import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { CreatorAvatar } from "@/features/creators/components/creator-avatar";
import { CreatorPlatformBadge } from "@/features/creators/components/creator-platform-badge";
import { DeleteVideoButton } from "@/features/videos/components/delete-video-button";
import { VideoEmptyState } from "@/features/videos/components/video-empty-state";
import { VideoStatusBadge } from "@/features/videos/components/video-status-badge";
import { groupVideosByCreator } from "@/features/videos/schemas";
import type { VideoWithCreator } from "@/features/videos/types";
import { formatTurkishDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatPublishDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return formatTurkishDate(value);
}

export function CampaignVideoList({
  campaignId,
  videos,
  syncAction,
  importAction,
}: {
  campaignId: string;
  videos: VideoWithCreator[];
  syncAction?: React.ReactNode;
  importAction?: React.ReactNode;
}) {
  const groups = groupVideosByCreator(videos);
  const platformCounts = videos.reduce<Record<string, number>>((acc, video) => {
    acc[video.platform] = (acc[video.platform] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section id="videos" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-white">Videolar</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <span>{videos.length} video</span>
            {Object.entries(platformCounts).map(([platform, count]) => (
              <span key={platform} className="inline-flex items-center gap-1.5">
                <CreatorPlatformBadge
                  platform={platform as VideoWithCreator["platform"]}
                />
                <span className="text-xs text-zinc-500">{count}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {syncAction}
          {videos.length > 0 ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {importAction}
              <Link
                href={`/campaigns/${campaignId}/videos/new`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Manuel Video Ekle
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {videos.length === 0 ? (
        <VideoEmptyState
          campaignId={campaignId}
          importAction={importAction}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div
              key={group.creator.id}
              className="overflow-hidden rounded-xl border border-zinc-800"
            >
              <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3">
                <CreatorAvatar
                  username={group.creator.username}
                  displayName={group.creator.display_name}
                  avatarUrl={group.creator.avatar_url}
                  size="sm"
                />
                <div>
                  <p className="font-medium text-white">
                    @{group.creator.username}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {group.videos.length} video
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-800 text-sm">
                  <thead className="bg-zinc-950/40">
                    <tr className="text-left text-zinc-400">
                      <th className="px-4 py-3 font-medium">Görsel</th>
                      <th className="px-4 py-3 font-medium">Platform</th>
                      <th className="px-4 py-3 font-medium">Yayın</th>
                      <th className="px-4 py-3 font-medium">Durum</th>
                      <th className="px-4 py-3 font-medium">URL</th>
                      <th className="px-4 py-3 font-medium text-right">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/20">
                    {group.videos.map((video) => (
                      <tr key={video.id} className="text-zinc-200">
                        <td className="px-4 py-3">
                          {video.thumbnail_url ? (
                            <div className="relative h-14 w-8 overflow-hidden rounded border border-zinc-800 bg-zinc-900">
                              {/* eslint-disable-next-line @next/next/no-img-element -- management list preview */}
                              <img
                                src={video.thumbnail_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500">Yok</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <CreatorPlatformBadge platform={video.platform} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatPublishDate(video.published_at)}
                        </td>
                        <td className="px-4 py-3">
                          <VideoStatusBadge status={video.status} />
                        </td>
                        <td className="px-4 py-3 max-w-[240px] truncate">
                          <a
                            href={video.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-400 hover:text-orange-300"
                          >
                            {video.video_url}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/campaigns/${campaignId}/videos/${video.id}`}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "sm" })
                              )}
                            >
                              Aç
                            </Link>
                            <Link
                              href={`/campaigns/${campaignId}/videos/${video.id}/edit`}
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" })
                              )}
                            >
                              Düzenle
                            </Link>
                            <DeleteVideoButton
                              campaignId={campaignId}
                              videoId={video.id}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
