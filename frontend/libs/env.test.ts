import { describe, it, expect } from "vitest";
import { API_BASE_URL } from "./env";

describe("API_BASE_URL", () => {
  it("defaults to the local backend when NEXT_PUBLIC_API_BASE_URL is unset", () => {
    // The test environment does not set NEXT_PUBLIC_API_BASE_URL, so the module
    // falls back to the documented local default.
    expect(API_BASE_URL).toBe("http://localhost:8080");
  });

  it("is a non-empty string usable as a URL base", () => {
    expect(typeof API_BASE_URL).toBe("string");
    expect(() => new URL("/health", API_BASE_URL)).not.toThrow();
  });
});
