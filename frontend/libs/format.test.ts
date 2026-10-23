import { describe, it, expect } from "vitest";
import {
  formatCountdown,
  formatCurrency,
  formatDateWIB,
  formatTimeWIB,
  summarize,
  statusPercent,
} from "./format";
import type { Payment } from "./types";

// Builds a minimal Payment with overridable fields for summary tests.
function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "PAY-0001",
    merchant: "Acme Corp",
    status: "completed",
    amount: "100.00",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("formatCurrency", () => {
  it("renders Rupiah with thousands separators and no decimals", () => {
    expect(formatCurrency("1250000.00")).toBe("Rp 1.250.000");
    expect(formatCurrency(2000)).toBe("Rp 2.000");
  });

  it("falls back to the raw input when not a number", () => {
    expect(formatCurrency("not-a-number")).toBe("not-a-number");
  });
});

describe("WIB formatters", () => {
  it("formats a UTC timestamp into the WIB (UTC+7) date", () => {
    // 2026-01-01T20:00Z is 2026-01-02 03:00 in Jakarta.
    expect(formatDateWIB("2026-01-01T20:00:00Z")).toBe("2 Jan 2026");
  });

  it("formats time with a WIB suffix", () => {
    expect(formatTimeWIB("2026-01-01T20:00:00Z")).toBe("03:00 WIB");
  });

  it("returns the input unchanged when it is not a valid date", () => {
    expect(formatDateWIB("garbage")).toBe("garbage");
  });
});

describe("summarize", () => {
  it("counts per status and sums volume overall and per status", () => {
    const payments = [
      payment({ status: "completed", amount: "100.00" }),
      payment({ status: "completed", amount: "50.00" }),
      payment({ status: "processing", amount: "25.00" }),
      payment({ status: "failed", amount: "10.00" }),
    ];
    const s = summarize(payments);
    expect(s.total).toBe(4);
    expect(s.completed).toBe(2);
    expect(s.processing).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.totalAmount).toBe(185);
    expect(s.amountByStatus.completed).toBe(150);
    expect(s.amountByStatus.failed).toBe(10);
  });

  it("handles an empty list without dividing by zero", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(statusPercent(s, "completed")).toBe(0);
  });
});

describe("statusPercent", () => {
  it("returns a one-decimal percentage share of the total", () => {
    const s = summarize([
      payment({ status: "completed" }),
      payment({ status: "completed" }),
      payment({ status: "failed" }),
    ]);
    expect(statusPercent(s, "completed")).toBe(66.7);
    expect(statusPercent(s, "failed")).toBe(33.3);
  });
});

describe("formatCountdown", () => {
  it("formats a millisecond duration as m:ss, rounding up partial seconds", () => {
    expect(formatCountdown(5 * 60 * 1000)).toBe("5:00");
    expect(formatCountdown(125_000)).toBe("2:05");
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-500)).toBe("0:00");
  });
});
