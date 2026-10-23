import type { Payment, PaymentStatus, PaymentsSummary } from "./types";

// DurianPay is an Indonesian product: amounts are Rupiah and times are shown in
// WIB (Western Indonesian Time, UTC+7 / Asia/Jakarta).
const WIB_TIME_ZONE = "Asia/Jakarta";

// IDR has no sub-unit in practice, so we render whole Rupiah with thousands
// separators, e.g. "Rp 1.250.000". Both fraction-digit bounds must be set to 0:
// id-ID currency defaults to 2 digits, and setting only one bound throws.
const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formats a decimal amount ("1250000.00" or number) as "Rp 1.250.000". */
export function formatCurrency(amount: string | number): string {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(value)) return String(amount);
  // id-ID renders "Rp1.250.000" (no space); add one for readability.
  return currencyFormatter.format(value).replace(/^Rp\s?/, "Rp ");
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: WIB_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: WIB_TIME_ZONE,
});

/** Formats an RFC3339 timestamp as the WIB calendar date, e.g. "21 Oct 2026". */
export function formatDateWIB(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return dateFormatter.format(date);
}

/** Formats an RFC3339 timestamp as the WIB wall-clock time, e.g. "13:04 WIB". */
export function formatTimeWIB(iso: string | number | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return `${timeFormatter.format(date)} WIB`;
}

/** Derives the dashboard summary figures (counts + volume) from the payments. */
export function summarize(payments: Payment[]): PaymentsSummary {
  const summary: PaymentsSummary = {
    total: payments.length,
    completed: 0,
    processing: 0,
    failed: 0,
    totalAmount: 0,
    amountByStatus: { completed: 0, processing: 0, failed: 0 },
  };
  for (const p of payments) {
    const amount = Number(p.amount) || 0;
    summary[p.status] += 1;
    summary.amountByStatus[p.status] += amount;
    summary.totalAmount += amount;
  }
  return summary;
}

/** Share of the total a status represents, e.g. 66.7, as a 1-dp percentage. */
export function statusPercent(summary: PaymentsSummary, status: PaymentStatus): number {
  if (summary.total === 0) return 0;
  return Math.round((summary[status] / summary.total) * 1000) / 10;
}

/** Formats a millisecond duration as a `m:ss` countdown, e.g. 125000 → "2:05". */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
