import { describe, it, expect } from "vitest";
import { PAYMENT_STATUSES } from "./types";

describe("PAYMENT_STATUSES", () => {
  it("lists the three payment statuses in display order", () => {
    expect(PAYMENT_STATUSES).toEqual(["completed", "processing", "failed"]);
  });
});
