import { Sidebar } from "@/components/dashboard/sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[#09090B]">
      <Sidebar />
      <main className="lg:pl-[240px]">
        <div className="mx-auto max-w-[1600px] px-4 pt-20 pb-10 sm:px-6 lg:px-8 lg:pt-10">
          {children}
        </div>
      </main>
    </div>
  );
}
