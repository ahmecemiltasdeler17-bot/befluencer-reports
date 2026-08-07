"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { MediaFallback } from "@/components/report/content/media-fallback";
import { shouldUseMediaFallback } from "@/lib/media-fallback-styles";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ReportVideoThumbnailProps {
  src?: string | null;
  seed: string;
  name: string;
  username?: string;
  title?: string;
  platform?: Platform | string;
  featured?: boolean;
  className?: string;
  sizes?: string;
  /**
   * Shows a discreet note when a real thumbnail existed but could not load —
   * TikTok CDN URLs are signed and expire, so historical snapshots degrade.
   */
  showUnavailableNotice?: boolean;
}

function platformLabel(platform: Platform | string): string {
  if (platform === "tiktok") return "TikTok";
  if (platform === "instagram") return "Instagram";
  if (platform === "youtube") return "YouTube";
  return platform;
}

/**
 * Report video poster: real TikTok cover first, deterministic BeFluencer
 * fallback on missing/failed URLs. Remembers a failed URL for the component
 * lifetime and only retries when `src` changes.
 */
export function ReportVideoThumbnail({
  src,
  seed,
  name,
  username,
  title,
  platform = "TikTok",
  featured = false,
  className,
  sizes = "330px",
  showUnavailableNotice = false,
}: ReportVideoThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc !== null && failedSrc === src;

  const shouldFallback = useMemo(
    () => shouldUseMediaFallback(src, failedSrc),
    [failedSrc, src]
  );

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      data-report-video-thumbnail={shouldFallback ? "fallback" : "image"}
    >
      {shouldFallback ? (
        <MediaFallback
          variant={featured ? "featured" : "video"}
          seed={seed}
          initials={initials}
          username={username}
          title={title}
          platform={platformLabel(platform)}
          showUnavailableNotice={showUnavailableNotice && failed}
        />
      ) : (
        <Image
          src={src as string}
          alt=""
          fill
          className="object-cover"
          sizes={sizes}
          onError={() => setFailedSrc(src ?? null)}
          unoptimized
        />
      )}
    </div>
  );
}
