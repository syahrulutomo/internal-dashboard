import { formatCurrency, statusPercent } from "@/libs/format";
import type { PaymentStatus, PaymentsSummary } from "@/libs/types";

interface PaymentsHeroProps {
  summary: PaymentsSummary | null;
  loading?: boolean;
}

// Per-status display metadata (label + bar/dot colour), ordered as shown.
const STATUS_META: { key: PaymentStatus; label: string; color: string }[] = [
  { key: "completed", label: "Completed", color: "bg-brand-400" },
  { key: "processing", label: "Processing", color: "bg-amber-400" },
  { key: "failed", label: "Failed", color: "bg-red-400" },
];

export function PaymentsHero({ summary, loading }: PaymentsHeroProps) {
  if (loading || !summary) {
    return (
      <div className="relative h-52 animate-pulse overflow-hidden rounded-3xl bg-brand-900/90" />
    );
  }

  const total = summary.total || 1;
  const successRate = statusPercent(summary, "completed");

  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-800 px-7 py-7 text-white sm:px-9">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-56 rotate-12 rounded-[3rem] bg-white/5"
      />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]">
        {/* Total payments + volume */}
        <div>
          <p className="text-sm text-brand-100/70">Total payments</p>
          <p className="mt-1 text-6xl font-semibold leading-none tabular-nums">
            {summary.total}
          </p>
          <p className="mt-4 text-sm text-brand-100/80">
            <span className="font-semibold text-brand-200">
              {formatCurrency(summary.totalAmount)}
            </span>{" "}
            in total volume
          </p>
        </div>

        {/* Status breakdown + success rate */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-brand-100/70">Status breakdown</p>
            <p className="text-sm text-brand-100/70">
              Success rate{" "}
              <span className="font-semibold text-white">{successRate}%</span>
            </p>
          </div>

          <div className="mt-3 flex h-3 gap-1 overflow-hidden rounded-full">
            {STATUS_META.map((s) => (
              <div
                key={s.key}
                className={`${s.color} rounded-full`}
                style={{ width: `${(summary[s.key] / total) * 100}%` }}
                title={`${s.label}: ${summary[s.key]}`}
              />
            ))}
          </div>

          {/* Per-status detail: count, share of total, and settled volume. */}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {STATUS_META.map((s) => (
              <StatusDetail
                key={s.key}
                color={s.color}
                label={s.label}
                count={summary[s.key]}
                percent={statusPercent(summary, s.key)}
                amount={summary.amountByStatus[s.key]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusDetail({
  color,
  label,
  count,
  percent,
  amount,
}: {
  color: string;
  label: string;
  count: number;
  percent: number;
  amount: number;
}) {
  return (
    <div className="rounded-xl bg-white/5 px-4 py-3">
      <span className="inline-flex items-center gap-2 text-sm text-brand-100/80">
        <span className={`size-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-white">
          {count}
        </span>
        <span className="text-sm font-medium text-brand-200">{percent}%</span>
      </div>
      <p className="mt-1 text-sm font-medium text-brand-100/90">
        {formatCurrency(amount)}
      </p>
    </div>
  );
}
