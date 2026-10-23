"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthSnapshot } from "@/libs/auth-storage";
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
    // The redirect decision reads the synchronous auth store (ground truth),
    // not only the React context value. Right after login/logout the context
    // value can lag the store by a render while the Next router transition
    // commits, which previously bounced a freshly-authenticated user back to
    // /login. `getAuthSnapshot()` reflects `saveAuth`/`clearAuth` immediately
    // (same source `apiFetch` reads via `getToken`), so the two must agree
    // before we redirect.
    const authedNow = Boolean(getAuthSnapshot());
    if (mode === "protected" && !isAuthenticated && !authedNow) {
      router.replace("/login");
    }
    if (mode === "guest" && isAuthenticated && authedNow) {
      router.replace("/dashboard");
    }
  }, [hydrated, isAuthenticated, mode, router]);

  const allowed =
    mode === "protected" ? isAuthenticated : !isAuthenticated;
  return { ready: hydrated && allowed, hydrated };
}
