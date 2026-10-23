import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCan } from "./use-can";
import { PERMISSIONS } from "@/libs/permissions";
import { ROLES } from "@/libs/types";

// Drive the session role without the real AuthProvider. We mock `use-auth` only;
// `libs/permissions` stays real so this exercises the actual RBAC policy.
const { authRef } = vi.hoisted(() => ({
  authRef: {
    current: { user: null as { role: string } | null },
  },
}));

vi.mock("./use-auth", () => ({ useAuth: () => authRef.current }));

beforeEach(() => {
  authRef.current = { user: null };
});

describe("useCan", () => {
  it("starts false (fail-closed) before the async check resolves", async () => {
    authRef.current = { user: { role: ROLES.OPERATION } };
    const { result } = renderHook(() => useCan(PERMISSIONS.PAYMENTS_EXPORT));
    // Synchronous first render: the @rbac/rbac check hasn't resolved yet.
    expect(result.current).toBe(false);
    // Let the pending async update settle so it doesn't leak past the test.
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("grants operation the export permission", async () => {
    authRef.current = { user: { role: ROLES.OPERATION } };
    const { result } = renderHook(() => useCan(PERMISSIONS.PAYMENTS_EXPORT));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("denies cs the export permission", async () => {
    authRef.current = { user: { role: ROLES.CS } };
    const { result } = renderHook(() => useCan(PERMISSIONS.PAYMENTS_EXPORT));
    // Give the async check a chance to (not) flip the value.
    await Promise.resolve();
    expect(result.current).toBe(false);
  });

  it("grants cs the view permission", async () => {
    authRef.current = { user: { role: ROLES.CS } };
    const { result } = renderHook(() => useCan(PERMISSIONS.PAYMENTS_VIEW));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("denies when there is no session", async () => {
    authRef.current = { user: null };
    const { result } = renderHook(() => useCan(PERMISSIONS.PAYMENTS_VIEW));
    await Promise.resolve();
    expect(result.current).toBe(false);
  });
});
