import Link from "next/link";

import type { DashboardActivityItem } from "@/features/dashboard/types";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DashboardActivity({
  activity,
}: {
  activity: DashboardActivityItem[];
}) {
  return (
    <section
      aria-labelledby="dashboard-activity-heading"
      className="admin-panel overflow-hidden"
    >
      <div className="border-b border-[var(--bf-border)] px-4 py-3">
        <h2
          id="dashboard-activity-heading"
          className="text-sm font-medium text-[var(--bf-text)]"
        >
          Son aktiviteler
        </h2>
      </div>

      {activity.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--bf-text-muted)]">
          Gösterilecek aktivite yok.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--bf-border)]">
          {activity.map((item) => {
            const content = (
              <>
                <p className="text-sm text-[var(--bf-text-secondary)]">
                  {item.label}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--bf-text-muted)]">
                  {formatDateTime(item.at)}
                </p>
              </>
            );

            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block px-4 py-3 transition-colors hover:bg-[var(--bf-elevated)]"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="px-4 py-3">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
