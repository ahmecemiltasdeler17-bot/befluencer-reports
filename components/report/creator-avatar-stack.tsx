"use client";

import { cn } from "@/lib/utils";

import { SafeAvatar } from "@/components/report/content/safe-media";

export interface CreatorAvatar {
  id: string;
  avatar: string;
  name: string;
}

interface CreatorAvatarStackProps {
  creators: CreatorAvatar[];
  overflowCount?: number;
  maxVisible?: number;
}

export function CreatorAvatarStack({
  creators,
  overflowCount = 12,
  maxVisible = 11,
}: CreatorAvatarStackProps) {
  const visible = creators.slice(0, maxVisible);

  return (
    <div className="flex flex-wrap items-center justify-center gap-y-2">
      {visible.map((creator, index) => (
        <div
          key={creator.id}
          className={cn(index > 0 && "-ml-2.5")}
          style={{ zIndex: visible.length - index }}
          title={creator.name}
        >
          <SafeAvatar
            src={creator.avatar}
            name={creator.name}
            seed={creator.id}
            size={42}
            className="size-[38px] ring-2 ring-[#09090B] transition-transform duration-200 hover:scale-110 min-[1100px]:size-[42px]"
          />
        </div>
      ))}

      {overflowCount > 0 && (
        <div
          className="-ml-2.5 relative z-0 flex size-[38px] shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300 ring-2 ring-[#09090B] transition-transform duration-200 hover:scale-110 min-[1100px]:size-[42px]"
          title={`+${overflowCount} içerik üreticisi`}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
