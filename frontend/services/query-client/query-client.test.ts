import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { getQueryClient } from "./index";

describe("getQueryClient", () => {
  it("returns a QueryClient instance", () => {
    expect(getQueryClient()).toBeInstanceOf(QueryClient);
  });

  it("reuses a single client in the browser", () => {
    // jsdom defines `window`, so the browser singleton branch applies.
    expect(getQueryClient()).toBe(getQueryClient());
  });

  it("applies the configured query defaults", () => {
    const defaults = getQueryClient().getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(30_000);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
    expect(defaults?.retry).toBe(1);
  });
});
