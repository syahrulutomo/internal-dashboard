import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy string values with a single space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("drops falsy values (false, null, undefined, empty string)", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("returns an empty string when given nothing truthy", () => {
    expect(cn()).toBe("");
    expect(cn(false, null, undefined)).toBe("");
  });
});
