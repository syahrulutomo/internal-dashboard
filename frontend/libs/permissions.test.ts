import { describe, it, expect } from "vitest";
import { can } from "./permissions";

describe("can", () => {
  it("grants payments:export to the operation role", async () => {
    await expect(can("operation", "payments:export")).resolves.toBe(true);
  });

  it("denies payments:export to the cs role", async () => {
    await expect(can("cs", "payments:export")).resolves.toBe(false);
  });

  it("denies everything when there is no role", async () => {
    await expect(can(null, "payments:export")).resolves.toBe(false);
    await expect(can(undefined, "payments:export")).resolves.toBe(false);
  });
});
