"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./use-auth";

/**
 * Client-side route guard.
 *
 * @param mode "protected" redirects unauthenticated users to /login;
 *             "guest" redirects already-authenticated users to /dashboard.
 * @returns `ready` — true once the session is hydrated and the current user is
 *          allowed on the route, so the caller can render its content.
 */
export function useAuthGuard(mode: "protected" | "guest") {
  const { isAuthenticated, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (mode === "protected" && !isAuthenticated) {
      router.replace("/login");
    }
    if (mode === "guest" && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [hydrated, isAuthenticated, mode, router]);

  const allowed =
    mode === "protected" ? isAuthenticated : !isAuthenticated;
  return { ready: hydrated && allowed, hydrated };
}
