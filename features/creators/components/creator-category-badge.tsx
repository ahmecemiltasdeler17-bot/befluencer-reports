import { Badge } from "@/components/ui/badge";
import type { CreatorCategory } from "@/features/creators/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<CreatorCategory, string> = {
  nano: "Nano",
  micro: "Mikro",
  macro: "Makro",
  mega: "Mega",
  template: "Şablon",
};

export function getCategoryLabel(category: CreatorCategory): string {
  return CATEGORY_LABELS[category];
}

export function CreatorCategoryBadge({
  category,
  className,
}: {
  category: CreatorCategory | null;
  className?: string;
}) {
  if (!category) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-zinc-800 bg-zinc-950/40 text-zinc-500",
          className
        )}
      >
        Kategorisiz
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-zinc-700 bg-zinc-900/60 text-zinc-300",
        className
      )}
    >
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}
