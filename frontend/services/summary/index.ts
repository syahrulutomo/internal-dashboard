import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/libs/api-client";
import type { PaymentsSummary, SummaryResponse } from "@/libs/types";

// Maps the API wire shape (snake_case, decimal-string amounts) onto the
// UI-facing `PaymentsSummary` (number amounts) so presentation components —
// PaymentsHero and RecentPayments — consume the same shape they always
// have and need no changes. This replaces the previous client-side `summarize`
// over the full payments list.
function toSummary(data: SummaryResponse): PaymentsSummary {
  return {
    total: data.total,
    completed: data.completed,
    processing: data.processing,
    failed: data.failed,
    totalAmount: Number(data.total_amount) || 0,
    amountByStatus: {
      completed: Number(data.amount_by_status.completed) || 0,
      processing: Number(data.amount_by_status.processing) || 0,
      failed: Number(data.amount_by_status.failed) || 0,
    },
  };
}

async function fetchSummary(): Promise<PaymentsSummary> {
  const data = await apiFetch<SummaryResponse>("/dashboard/v1/payments/summary");
  return toSummary(data);
}

// Shared query contract, mirroring `paymentsQuery` in services/payments. The
// summary has no filter — it always reflects the full dataset — so the key is
// static.
export const summaryQuery = {
  all: ["summary"] as const,
  options: () =>
    queryOptions({
      queryKey: summaryQuery.all,
      queryFn: fetchSummary,
    }),
};

export function useSummary(options: { enabled?: boolean } = {}) {
  // `enabled` lets the caller gate the fetch on an RBAC check (e.g. the
  // payments:summary permission) so we don't request figures a role may not see.
  return useQuery({ ...summaryQuery.options(), enabled: options.enabled });
}
