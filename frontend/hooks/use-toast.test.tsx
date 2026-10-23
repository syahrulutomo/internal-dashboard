import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { ToastProvider, useToast } from "./use-toast";

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useToast", () => {
  it("throws when used outside a ToastProvider", () => {
    // Silence the expected React error boundary console noise.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(
      /must be used within a ToastProvider/,
    );
    spy.mockRestore();
  });

  it("adds a toast with defaults and returns its id", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let id = "";
    act(() => {
      id = result.current.toast({ title: "Saved" });
    });

    expect(id).toMatch(/^toast-/);
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      id,
      title: "Saved",
      variant: "info",
      duration: 4000,
    });
  });

  it("dismiss removes a toast by id", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let id = "";
    act(() => {
      id = result.current.toast({ title: "Hi", duration: 0 });
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => result.current.dismiss(id));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("auto-dismisses after the variant's default duration", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.toast({ title: "Oops", variant: "error" });
    });
    expect(result.current.toasts).toHaveLength(1);

    // error default is 6000ms.
    act(() => vi.advanceTimersByTime(5999));
    expect(result.current.toasts).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("keeps a toast with duration 0 until manually dismissed", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.toast({ title: "Sticky", duration: 0 });
    });

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.toasts).toHaveLength(1);
  });
});
