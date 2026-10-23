import {
  keepPreviousData,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";
import { apiFetch } from "@/libs/api-client";
import type { PaymentListResponse, PaymentStatus } from "@/libs/types";

export interface PaymentsFilter {
  // Server-side status filter. `undefined` means "all" — the status round-trips
  // to the API (requirement 2.1.3), it is not filtered on the client.
  status?: PaymentStatus;
  sort?: string;
  // Free-text search matched server-side against a partial payment id or
  // merchant name. `undefined`/empty means "no search".
  search?: string;
  // 1-based page number and page size. Both round-trip to the API, which
  // returns the matching page plus pagination metadata in `meta`.
  page?: number;
  perPage?: number;
}

async function fetchPayments(
  filter: PaymentsFilter,
): Promise<PaymentListResponse> {
  const data = await apiFetch<PaymentListResponse>("/dashboard/v1/payments", {
    params: {
      status: filter.status,
      search: filter.search,
      sort: filter.sort,
      page: filter.page != null ? String(filter.page) : undefined,
      per_page: filter.perPage != null ? String(filter.perPage) : undefined,
    },
  });
  return { payments: data.payments ?? [], meta: data.meta };
}

// Shared query contract so the key and fetcher stay together. The filter is
// part of the key, so changing the status or page triggers a refetch, and each
// page is cached independently. `keepPreviousData` keeps the current page's
// rows on screen while the next page loads, avoiding a skeleton flash.
export const paymentsQuery = {
  all: ["payments"] as const,
  options: (filter: PaymentsFilter = {}) =>
    queryOptions({
      queryKey: [...paymentsQuery.all, filter] as const,
      queryFn: () => fetchPayments(filter),
      placeholderData: keepPreviousData,
    }),
};

export function usePayments(
  filter: PaymentsFilter = {},
  options: { enabled?: boolean } = {},
) {
  // `enabled` lets the caller gate the fetch on an RBAC check (e.g. the
  // payments:view permission) so we don't request rows a role may not see.
  return useQuery({ ...paymentsQuery.options(filter), enabled: options.enabled });
}

// Export filter: only the status round-trips (export mirrors the list's status
// filter, not its search/pagination).
export type PaymentsExportFilter = Pick<PaymentsFilter, "status">;

// Fetches the full set of payments matching the status filter from the
// role-restricted export endpoint. The server returns 403 (surfaced as an
// ApiError) if the caller's role may not export — the UI also hides the CTA, but
// this is the enforced boundary.
async function fetchPaymentsExport(
  filter: PaymentsExportFilter,
): Promise<PaymentListResponse> {
  const data = await apiFetch<PaymentListResponse>(
    "/dashboard/v1/payments/export",
    { params: { status: filter.status } },
  );
  return { payments: data.payments ?? [], meta: data.meta };
}

// Query contract for the on-demand export (fetched via queryClient.fetchQuery in
// the container when the user clicks Export, not rendered as a live query).
export const paymentsExportQuery = {
  all: ["payments", "export"] as const,
  options: (filter: PaymentsExportFilter = {}) =>
    queryOptions({
      queryKey: [...paymentsExportQuery.all, filter] as const,
      queryFn: () => fetchPaymentsExport(filter),
    }),
};
