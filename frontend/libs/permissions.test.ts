import { describe, it, expect } from "vitest";
import { can } from "./permissions";

describe("can", () => {
  it("grants payments:export to the operation role", () => {
    expect(can("operation", "payments:export")).toBe(true);
  });

  it("denies payments:export to the cs role", () => {
    expect(can("cs", "payments:export")).toBe(false);
  });

  it("denies everything when there is no role", () => {
    expect(can(null, "payments:export")).toBe(false);
    expect(can(undefined, "payments:export")).toBe(false);
  });
});
