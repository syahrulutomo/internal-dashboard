import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearAuth,
  getAuthSnapshot,
  getServerAuthSnapshot,
  getToken,
  saveAuth,
  subscribeAuth,
} from "./auth-storage";
import type { AuthUser } from "./types";

const user: AuthUser = {
  email: "cs@test.com",
  role: "cs",
  token: "jwt-token-123",
};

// Reads the raw session cookie value the store persists under, or null.
function readTokenCookie(): string | null {
  const prefix = "internal_token=";
  const row = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix));
  return row ? decodeURIComponent(row.slice(prefix.length)) : null;
}

beforeEach(() => {
  // Reset persisted + in-memory state between tests.
  clearAuth();
});

describe("auth-storage", () => {
  it("returns null before any session is saved", () => {
    expect(getAuthSnapshot()).toBeNull();
    expect(getToken()).toBeNull();
  });

  it("always reports null for the server snapshot", () => {
    saveAuth(user);
    expect(getServerAuthSnapshot()).toBeNull();
  });

  it("saveAuth persists the user to a cookie and exposes it via the snapshot", () => {
    saveAuth(user);
    expect(getAuthSnapshot()).toEqual(user);
    expect(getToken()).toBe("jwt-token-123");
    expect(JSON.parse(readTokenCookie()!)).toEqual(user);
    // The session must not be written to localStorage.
    expect(window.localStorage.getItem("internal_token")).toBeNull();
  });

  it("clearAuth removes the session from the snapshot and the cookie", () => {
    saveAuth(user);
    clearAuth();
    expect(getAuthSnapshot()).toBeNull();
    expect(getToken()).toBeNull();
    expect(readTokenCookie()).toBeNull();
  });

  it("notifies subscribers on save and clear, and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAuth(listener);

    saveAuth(user);
    expect(listener).toHaveBeenCalledTimes(1);

    clearAuth();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    saveAuth(user);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
