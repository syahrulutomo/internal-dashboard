"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  clearAuth,
  getAuthSnapshot,
  getServerAuthSnapshot,
  saveAuth,
  subscribeAuth,
} from "@/libs/auth-storage";
import type { AuthUser } from "@/libs/types";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  // Becomes true once the component has mounted on the client, so route guards
  // don't redirect (or flash) before the persisted session is known.
  hydrated: boolean;
  setSession: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Read the session straight from the external store. On the server (and the
  // first client render) this is null; after hydration it reflects the session
  // cookie — with no setState-in-effect.
  const user = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getServerAuthSnapshot,
  );
  // `false` on the server, `true` after the client mounts — a hydration flag
  // without an effect.
  const hydrated = useSyncExternalStore(
    subscribeAuth,
    () => true,
    () => false,
  );

  const setSession = useCallback((next: AuthUser) => {
    saveAuth(next);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    // Drop any cached protected data so a different user can't see it.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      hydrated,
      setSession,
      logout,
    }),
    [user, hydrated, setSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
