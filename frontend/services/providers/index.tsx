"use client";

import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/views/presentation/Toaster";
import { getQueryClient } from "../query-client";

// App-wide client providers: TanStack Query for server state, Toast for
// transient notifications, Auth for session state. Auth sits inside the
// QueryClientProvider because it uses the query client to clear cached data on
// logout. The Toaster is rendered once here so any component can raise a toast.
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </ToastProvider>
    </QueryClientProvider>
  );
}
