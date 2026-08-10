import Link from "next/link";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "overview", label: "Genel Bakış", href: (id: string) => `/campaigns/${id}#overview` },
  { id: "creators", label: "İçerik Üreticileri", href: (id: string) => `/campaigns/${id}#creators` },
  { id: "videos", label: "Videolar", href: (id: string) => `/campaigns/${id}#videos` },
  { id: "metrics", label: "Metrikler", href: (id: string) => `/campaigns/${id}#metrics` },
  { id: "report", label: "Rapor", href: (id: string) => `/campaigns/${id}#report` },
] as const;

export function CampaignSectionNav({
  campaignId,
  activeSection = "overview",
}: {
  campaignId: string;
  activeSection?: (typeof SECTIONS)[number]["id"];
}) {
  return (
    <nav className="flex flex-wrap gap-1.5 border-b border-bf-border pb-3">
      {SECTIONS.map((section) => (
        <Link
          key={section.id}
          href={section.href(campaignId)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            activeSection === section.id
              ? "bg-primary/15 font-medium text-primary ring-1 ring-primary/30"
              : "text-bf-steel hover:bg-bf-elevated hover:text-bf-text"
          )}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
