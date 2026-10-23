import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { paymentsQuery, usePayments, type PaymentsFilter } from "./index";

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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("paymentsQuery", () => {
  it("namespaces the base key under 'payments'", () => {
    expect(paymentsQuery.all).toEqual(["payments"]);
  });

  it("includes the filter in the query key so each page caches separately", () => {
    const filter: PaymentsFilter = { status: "completed", page: 2 };
    expect(paymentsQuery.options(filter).queryKey).toEqual([
      "payments",
      filter,
    ]);
  });
});

describe("usePayments", () => {
  it("round-trips the filter as query params and returns the page", async () => {
    const response = {
      payments: [
        {
          id: "PAY-1",
          merchant: "Acme",
          status: "completed",
          amount: "100.00",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      meta: { page: 2, per_page: 10, total: 1, total_pages: 1 },
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(response),
      json: async () => response,
    });

    const { result } = renderHook(
      () =>
        usePayments({ status: "completed", search: "ac", page: 2, perPage: 10 }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/dashboard/v1/payments");
    expect(url.searchParams.get("status")).toBe("completed");
    expect(url.searchParams.get("search")).toBe("ac");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("per_page")).toBe("10");
  });

  it("defaults payments to an empty array when the API omits them", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ meta: undefined }),
      json: async () => ({}),
    });

    const { result } = renderHook(() => usePayments(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.payments).toEqual([]);
  });
});
