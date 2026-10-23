import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./use-auth";
import { clearAuth } from "@/libs/auth-storage";
import type { AuthUser } from "@/libs/types";

const user: AuthUser = { email: "cs@test.com", role: "cs", token: "tok-1" };

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  clearAuth();
  window.localStorage.clear();
});

describe("useAuth", () => {
  it("throws when used outside an AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      /must be used within an AuthProvider/,
    );
    spy.mockRestore();
  });

  it("starts unauthenticated and hydrated on the client", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(new QueryClient()),
    });
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.hydrated).toBe(true);
  });

  it("setSession authenticates the user", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(new QueryClient()),
    });

    act(() => result.current.setSession(user));

    expect(result.current.user).toEqual(user);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("logout clears the session and the query cache", () => {
    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, "clear");
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => result.current.setSession(user));
    act(() => result.current.logout());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(clearSpy).toHaveBeenCalled();
  });
});
