import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { apiFetch, ApiError } from "./api-client";
import { saveAuth, clearAuth } from "./auth-storage";

// A minimal stand-in for a fetch Response covering the fields api-client reads.
function makeResponse({
  ok = true,
  status = 200,
  json,
  text,
}: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}) {
  return {
    ok,
    status,
    text: async () => (text !== undefined ? text : JSON.stringify(json ?? "")),
    json: async () => {
      if (json === undefined) throw new Error("no json");
      return json;
    },
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  clearAuth();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("builds the URL against the API base and appends non-empty params", async () => {
    fetchMock.mockResolvedValue(makeResponse({ json: { ok: true } }));

    await apiFetch("/dashboard/v1/payments", {
      params: { status: "completed", page: "2", search: undefined, sort: "" },
    });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin).toBe("http://localhost:8080");
    expect(url.pathname).toBe("/dashboard/v1/payments");
    expect(url.searchParams.get("status")).toBe("completed");
    expect(url.searchParams.get("page")).toBe("2");
    // undefined and empty-string params are skipped.
    expect(url.searchParams.has("search")).toBe(false);
    expect(url.searchParams.has("sort")).toBe(false);
  });

  it("parses and returns the JSON body on success", async () => {
    fetchMock.mockResolvedValue(makeResponse({ json: { id: "PAY-1" } }));
    const data = await apiFetch<{ id: string }>("/anything");
    expect(data).toEqual({ id: "PAY-1" });
  });

  it("attaches the bearer token by default when a session exists", async () => {
    saveAuth({ email: "cs@test.com", role: "cs", token: "tok-abc" });
    fetchMock.mockResolvedValue(makeResponse({ json: {} }));

    await apiFetch("/protected");

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer tok-abc");
  });

  it("omits the Authorization header when auth is false", async () => {
    saveAuth({ email: "cs@test.com", role: "cs", token: "tok-abc" });
    fetchMock.mockResolvedValue(makeResponse({ json: {} }));

    await apiFetch("/public", { auth: false });

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });

  it("serializes the body and sets the JSON content type", async () => {
    fetchMock.mockResolvedValue(makeResponse({ json: {} }));

    await apiFetch("/login", {
      method: "POST",
      auth: false,
      body: { email: "a@b.com", password: "pw" },
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe(JSON.stringify({ email: "a@b.com", password: "pw" }));
    expect((init.headers as Headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("throws an ApiError carrying the server status and message on failure", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: false, status: 400, json: { message: "Bad input" } }),
    );

    await expect(apiFetch("/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Bad input",
    });
  });

  it("falls back to a friendly 401 message when none is provided", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: false, status: 401, text: "" }),
    );

    await expect(apiFetch("/x")).rejects.toMatchObject({
      status: 401,
      message: "Invalid credentials or session expired.",
    });
  });

  it("wraps a network failure as an ApiError with status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const err = (await apiFetch("/x").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/Unable to reach the server/);
  });

  it("returns undefined for an empty (204) body", async () => {
    fetchMock.mockResolvedValue(makeResponse({ status: 204, text: "" }));
    const data = await apiFetch("/no-content");
    expect(data).toBeUndefined();
  });
});
