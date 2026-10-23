import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAuthGuard } from "./use-auth-guard";

// Control the auth state and spy on router navigation without the real
// providers — the guard's logic is what we're exercising here.
const { replace, authRef } = vi.hoisted(() => ({
  replace: vi.fn(),
  authRef: {
    current: { isAuthenticated: false, hydrated: false } as {
      isAuthenticated: boolean;
      hydrated: boolean;
    },
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("./use-auth", () => ({ useAuth: () => authRef.current }));
// The guard cross-checks the synchronous auth store before redirecting (to
// avoid bouncing a just-authenticated user while the context value lags a
// render). In these unit tests the store mirrors the mocked auth state.
vi.mock("@/libs/auth-storage", () => ({
  getAuthSnapshot: () =>
    authRef.current.isAuthenticated
      ? { email: "u@test.com", role: "operation", token: "t" }
      : null,
}));

beforeEach(() => {
  replace.mockReset();
  authRef.current = { isAuthenticated: false, hydrated: false };
});

describe("useAuthGuard", () => {
  it("does not redirect before the session has hydrated", () => {
    authRef.current = { isAuthenticated: false, hydrated: false };
    const { result } = renderHook(() => useAuthGuard("protected"));
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(false);
  });

  it("protected: redirects an unauthenticated user to /login", () => {
    authRef.current = { isAuthenticated: false, hydrated: true };
    const { result } = renderHook(() => useAuthGuard("protected"));
    expect(replace).toHaveBeenCalledWith("/login");
    expect(result.current.ready).toBe(false);
  });

  it("protected: lets an authenticated user through", () => {
    authRef.current = { isAuthenticated: true, hydrated: true };
    const { result } = renderHook(() => useAuthGuard("protected"));
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(true);
  });

  it("guest: redirects an authenticated user to /dashboard", () => {
    authRef.current = { isAuthenticated: true, hydrated: true };
    const { result } = renderHook(() => useAuthGuard("guest"));
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(result.current.ready).toBe(false);
  });

  it("guest: lets an unauthenticated user through", () => {
    authRef.current = { isAuthenticated: false, hydrated: true };
    const { result } = renderHook(() => useAuthGuard("guest"));
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(true);
  });
});
