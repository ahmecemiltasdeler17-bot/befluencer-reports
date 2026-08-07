import { ManagementNav } from "@/components/internal/management-nav";

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <ManagementNav />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
