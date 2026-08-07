"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

const TABS = [
  { id: "existing", label: "Mevcut İçerik Üreticisi" },
  { id: "new", label: "Yeni İçerik Üreticisi" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AddCreatorTabs({
  existingPanel,
  newPanel,
}: {
  existingPanel: React.ReactNode;
  newPanel: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("existing");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              activeTab === tab.id
                ? "bg-zinc-900 font-medium text-white"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "existing" ? existingPanel : newPanel}
    </div>
  );
}
