import type { ReactNode } from "react";
import { Sidebar } from "../Sidebar";
import { Topbar } from "../Topbar";
import type { AuthUser } from "@/libs/types";

interface DashboardShellProps {
  user: AuthUser;
  onLogout: () => void;
  children: ReactNode;
}

// Presentational layout frame: sidebar + a breadcrumb/user bar + the scrollable
// content area.
export function DashboardShell({
  user,
  onLogout,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onLogout={onLogout} />
        <main className="flex-1 space-y-7 px-5 pb-12 pt-1 sm:px-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
