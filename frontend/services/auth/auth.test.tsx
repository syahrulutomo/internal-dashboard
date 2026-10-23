import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLogin } from "./index";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
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

describe("useLogin", () => {
  it("posts credentials to the login endpoint without a bearer token", async () => {
    const user = { email: "cs@test.com", role: "cs", token: "jwt" };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(user),
      json: async () => user,
    });

    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });

    result.current.mutate({ email: "cs@test.com", password: "password" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(user);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/dashboard/v1/auth/login");
    expect(init.method).toBe("POST");
    expect((init.headers as Headers).get("Authorization")).toBeNull();
    expect(init.body).toBe(
      JSON.stringify({ email: "cs@test.com", password: "password" }),
    );
  });

  it("surfaces an ApiError on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "",
      json: async () => ({ message: "Invalid credentials" }),
    });

    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });
    result.current.mutate({ email: "x@y.com", password: "bad" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 401 });
  });
});
