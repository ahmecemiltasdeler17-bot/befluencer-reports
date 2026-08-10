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
          "border-bf-border bg-bf-bg/60 text-bf-steel/70",
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
        "border-bf-border bg-bf-elevated/80 text-bf-steel",
        className
      )}
    >
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}
