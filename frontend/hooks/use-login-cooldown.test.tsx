import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLoginCooldown } from "./use-login-cooldown";
import { clearCooldown, startCooldown } from "@/libs/login-cooldown";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  clearCooldown();
  window.localStorage.clear();
});

afterEach(() => {
  act(() => clearCooldown());
  vi.useRealTimers();
});

describe("useLoginCooldown", () => {
  it("reports no cooldown when none is active", () => {
    const { result } = renderHook(() => useLoginCooldown());
    expect(result.current.isCoolingDown).toBe(false);
    expect(result.current.remainingMs).toBe(0);
  });

  it("reflects an active cooldown and its remaining time", () => {
    const { result } = renderHook(() => useLoginCooldown());

    act(() => startCooldown(5000));
    expect(result.current.isCoolingDown).toBe(true);
    expect(result.current.remainingMs).toBe(5000);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.remainingMs).toBe(3000);
  });

  it("clears itself once the deadline elapses", () => {
    const { result } = renderHook(() => useLoginCooldown());

    act(() => startCooldown(3000));
    expect(result.current.isCoolingDown).toBe(true);

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.isCoolingDown).toBe(false);
    expect(result.current.remainingMs).toBe(0);
  });
});
