import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { summaryQuery, useSummary } from "./index";
import { clearAuth, saveAuth } from "@/libs/auth-storage";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  // Protected endpoint — a session token must be present for apiFetch to send.
  saveAuth({ email: "cs@test.com", role: "cs", token: "tok-test" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearAuth();
});

describe("summaryQuery", () => {
  it("uses a static key (no filter)", () => {
    expect(summaryQuery.all).toEqual(["summary"]);
    expect(summaryQuery.options().queryKey).toEqual(["summary"]);
  });
});

describe("useSummary", () => {
  it("maps the snake_case wire shape onto the UI summary with numeric amounts", async () => {
    const wire = {
      total: 48,
      completed: 30,
      processing: 10,
      failed: 8,
      total_amount: "1250000.00",
      amount_by_status: {
        completed: "700000.00",
        processing: "400000.00",
        failed: "150000.00",
      },
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(wire),
      json: async () => wire,
    });

    const { result } = renderHook(() => useSummary(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      total: 48,
      completed: 30,
      processing: 10,
      failed: 8,
      totalAmount: 1_250_000,
      amountByStatus: {
        completed: 700_000,
        processing: 400_000,
        failed: 150_000,
      },
    });

    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe(
      "/dashboard/v1/payments/summary",
    );
  });

  it("coerces unparseable amounts to 0", async () => {
    const wire = {
      total: 0,
      completed: 0,
      processing: 0,
      failed: 0,
      total_amount: "not-a-number",
      amount_by_status: { completed: "", processing: "x", failed: "y" },
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(wire),
      json: async () => wire,
    });

    const { result } = renderHook(() => useSummary(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalAmount).toBe(0);
    expect(result.current.data?.amountByStatus).toEqual({
      completed: 0,
      processing: 0,
      failed: 0,
    });
  });
});
