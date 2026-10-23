import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/libs/api-client";
import type { AuthUser, LoginRequest, UserInfo } from "@/libs/types";

async function login(payload: LoginRequest): Promise<AuthUser> {
  // Public endpoint — no bearer token attached.
  return apiFetch<AuthUser>("/dashboard/v1/auth/login", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

/**
 * useLogin exposes the login mutation. The caller persists the returned session
 * via the auth context and handles navigation.
 */
export function useLogin() {
  return useMutation({
    mutationFn: login,
  });
}

async function fetchMe(): Promise<UserInfo> {
  return apiFetch<UserInfo>("/dashboard/v1/auth/me");
}

// Shared query contract for the authenticated user's identity, mirroring
// `summaryQuery`/`paymentsQuery`. The role it returns is server-authoritative
// and drives RBAC decisions in the UI.
export const meQuery = {
  all: ["me"] as const,
  options: () =>
    queryOptions({
      queryKey: meQuery.all,
      queryFn: fetchMe,
    }),
};

export function useMe(options: { enabled?: boolean } = {}) {
  // `enabled` lets the caller gate the request on auth state so /auth/me is only
  // hit once the user is authenticated (an unauthenticated call would 401).
  return useQuery({ ...meQuery.options(), enabled: options.enabled });
}
