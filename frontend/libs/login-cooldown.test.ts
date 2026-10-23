import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  clearCooldown,
  getCooldownUntil,
  getServerCooldownUntil,
  startCooldown,
  subscribeCooldown,
} from "./login-cooldown";

beforeEach(() => {
  clearCooldown();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("login-cooldown", () => {
  it("has no active cooldown by default", () => {
    expect(getCooldownUntil()).toBe(0);
  });

  it("always reports 0 for the server snapshot", () => {
    startCooldown(5000);
    expect(getServerCooldownUntil()).toBe(0);
  });

  it("startCooldown sets a future deadline and persists it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const now = Date.now();

    startCooldown(5 * 60 * 1000);

    expect(getCooldownUntil()).toBe(now + 5 * 60 * 1000);
    expect(window.localStorage.getItem("login_cooldown_until")).toBe(
      String(now + 5 * 60 * 1000),
    );
  });

  it("clearCooldown resets the deadline and removes it from storage", () => {
    startCooldown(5000);
    clearCooldown();
    expect(getCooldownUntil()).toBe(0);
    expect(window.localStorage.getItem("login_cooldown_until")).toBeNull();
  });

  it("notifies subscribers on start and clear, and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCooldown(listener);

    startCooldown(5000);
    expect(listener).toHaveBeenCalledTimes(1);

    clearCooldown();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    startCooldown(5000);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
