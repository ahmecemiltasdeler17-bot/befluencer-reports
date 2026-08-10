"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Compact admin-list thumbnail. Never shows browser broken-image chrome.
 * On load failure → branded graphite fallback. Null URL → same fallback.
 */
export function AdminVideoThumbnail({
  src,
  seed,
  username,
  platform = "TikTok",
  className,
}: {
  src: string | null | undefined;
  seed: string;
  username?: string | null;
  platform?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const handle = username?.replace(/^@/, "") ?? null;
  const platformBadge =
    platform.toLowerCase() === "tiktok"
      ? "TikTok"
      : platform.slice(0, 1).toUpperCase() + platform.slice(1);

  return (
    <div
      className={cn(
        "relative h-14 w-8 overflow-hidden rounded border border-bf-border bg-bf-elevated",
        className
      )}
      data-admin-video-thumbnail={showImage ? "image" : "fallback"}
      data-thumbnail-seed={seed}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- management list; onError → branded fallback
        <img
          src={src!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-[#181d26] via-[#141820] to-[#0c0e12] p-1"
          aria-hidden
        >
          <div className="flex items-start justify-between gap-0.5">
            <span className="rounded bg-black/55 px-0.5 text-[5px] font-medium text-white/85 ring-1 ring-white/10">
              {platformBadge === "TikTok" ? "TT" : platformBadge.slice(0, 2)}
            </span>
            <span className="text-[6px] font-semibold tracking-wider text-[#a8d4f0]/75">
              BF
            </span>
          </div>
          <div className="space-y-0.5">
            {handle ? (
              <p className="truncate text-[5px] leading-none text-white/70">
                @{handle}
              </p>
            ) : null}
            <p className="text-[5px] leading-tight text-white/45">
              Görsel alınamadı
            </p>
          </div>
        </div>
      )}
      <span className="sr-only">
        {showImage ? "Video görseli" : "Görsel alınamadı"}
      </span>
    </div>
  );
}
