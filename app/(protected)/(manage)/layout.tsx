import { ManagementNav } from "@/components/internal/management-nav";

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell min-h-screen bg-[var(--bf-bg)] text-[var(--bf-text)]">
      <ManagementNav />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
