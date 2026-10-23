import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/libs/api-client";
import type { AuthUser, LoginRequest } from "@/libs/types";

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
