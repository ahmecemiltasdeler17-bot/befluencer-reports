"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { ReportVideoThumbnail } from "@/components/report/media/report-video-thumbnail";
import { shouldUseMediaFallback } from "@/lib/media-fallback-styles";
import { cn } from "@/lib/utils";

import { MediaFallback } from "./media-fallback";

interface SafeAvatarProps {
  src?: string | null;
  name: string;
  seed?: string;
  className?: string;
  size?: number;
}

export function SafeAvatar({
  src,
  name,
  seed,
  className,
  size = 40,
}: SafeAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const safeName = typeof name === "string" ? name : "";
  const fallbackSeed = seed ?? safeName;
  const initials = safeName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const shouldFallback = useMemo(
    () => shouldUseMediaFallback(src, failedSrc),
    [failedSrc, src]
  );

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full ring-1 ring-white/10",
        className
      )}
      style={{ width: size, height: size }}
    >
      {shouldFallback ? (
        <MediaFallback
          variant="avatar"
          seed={fallbackSeed}
          initials={initials}
        />
      ) : (
        <Image
          src={src as string}
          alt=""
          fill
          className="object-cover"
          sizes={`${size}px`}
          onError={() => setFailedSrc(src ?? null)}
          unoptimized
        />
      )}
    </div>
  );
}

/** @deprecated Prefer `ReportVideoThumbnail` — kept as a thin alias. */
export { ReportVideoThumbnail as SafeThumbnail };
