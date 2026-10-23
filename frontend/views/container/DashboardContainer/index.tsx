"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { paymentsExportQuery, usePayments } from "@/services/payments";
import { useSummary } from "@/services/summary";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useCan } from "@/hooks/use-can";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/libs/api-client";
import { formatDateWIB, formatTimeWIB } from "@/libs/format";
import { DashboardShell } from "@/views/presentation/DashboardShell";
import { PaymentsHeader } from "@/views/presentation/PaymentsHeader";
import { PaymentsHero } from "@/views/presentation/PaymentsHero";
import {
  RecentPayments,
  type StatusFilterValue,
} from "@/views/presentation/RecentPayments";
import { Spinner } from "@/views/ui/Spinner";
import type { Payment } from "@/libs/types";

// Builds a CSV from the current payment rows. Values are quoted so merchant
// names containing commas survive the round-trip.
function toCsv(payments: Payment[]): string {
  const header = ["Payment ID", "Merchant", "Status", "Amount (IDR)", "Date (WIB)"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = payments.map((p) =>
    [
      p.id,
      p.merchant,
      p.status,
      p.amount,
      `${formatDateWIB(p.created_at)} ${formatTimeWIB(p.created_at)}`,
    ]
      .map(escape)
      .join(","),
  );
  return [header.map(escape).join(","), ...rows].join("\n");
}

function downloadCsv(payments: Payment[]): void {
  const blob = new Blob([toCsv(payments)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `durianpay-payments-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Rows per page for the paginated payments table.
const PAGE_SIZE = 10;

export function DashboardContainer() {
  const { user, logout } = useAuth();
  const { ready } = useAuthGuard("protected");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // RBAC: only the operation role may export (enforced server-side too).
  const canExport = useCan("payments:export");
  const [status, setStatus] = useState<StatusFilterValue>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  // The raw input updates on every keystroke, but only the settled value
  // round-trips to the API — avoids a request per character.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  // Changing the status filter (from the tabs or a stat card) must reset the
  // table back to the first page — page 3 of "all" is meaningless for "failed".
  const handleStatusChange = useCallback((next: StatusFilterValue) => {
    setStatus(next);
    setPage(1);
  }, []);

  // Typing a new search narrows the result set, so an old page number can fall
  // out of range — reset to the first page as the term changes (same reason as
  // changing the status filter).
  const handleSearchChange = useCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, []);

  // The hero, stat cards and tab counts are the summary widget: counts and
  // volume across the full dataset, computed server-side by
  // GET /dashboard/v1/payments/summary — the single source for these figures.
  // (CSV export fetches the actual rows on demand in handleExport, so the
  // dashboard no longer eagerly pulls the full list just to show the summary.)
  const summaryQuery = useSummary();
  // The table list round-trips the status filter and pagination to the API.
  const tableQuery = usePayments({
    status: status === "all" ? undefined : status,
    search: debouncedSearch || undefined,
    page,
    perPage: PAGE_SIZE,
  });

  // A 401 from a protected call means the session is no longer valid — sign out.
  const authError =
    (summaryQuery.error instanceof ApiError &&
      summaryQuery.error.status === 401) ||
    (tableQuery.error instanceof ApiError && tableQuery.error.status === 401);
  useEffect(() => {
    if (authError) logout();
  }, [authError, logout]);

  // Surface a failed payments load as a toast (not an inline banner), with a
  // Retry action. 401s are excluded — they trigger logout above, not a toast.
  // `refetch` is a stable reference from TanStack Query, and keying off the
  // error object fires the toast once per distinct failure.
  const tableError = tableQuery.error;
  const refetchTable = tableQuery.refetch;
  useEffect(() => {
    if (!tableError) return;
    if (tableError instanceof ApiError && tableError.status === 401) return;
    toast({
      variant: "error",
      title: "Couldn't load payments",
      description:
        tableError instanceof ApiError
          ? tableError.message
          : "Please check your connection and try again.",
      action: { label: "Retry", onClick: () => refetchTable() },
    });
  }, [tableError, toast, refetchTable]);

  // Summary widget data comes straight from the API (already mapped to the
  // UI shape by the service), so no client-side derivation is needed.
  const summary = summaryQuery.data ?? null;

  const tablePayments = tableQuery.data?.payments ?? [];
  const tableMeta = tableQuery.data?.meta;

  // How many rows an export would contain for the active status filter, read
  // from the summary (no row fetch needed just to enable/disable the button).
  const exportableCount = summary
    ? status === "all"
      ? summary.total
      : summary[status]
    : 0;

  const updatedAt = Math.max(
    summaryQuery.dataUpdatedAt,
    tableQuery.dataUpdatedAt,
  );
  const updatedLabel = updatedAt ? formatTimeWIB(updatedAt) : null;

  const handleRefresh = useCallback(() => {
    summaryQuery.refetch();
    tableQuery.refetch();
  }, [summaryQuery, tableQuery]);

  // Export fetches the matching rows on demand (only when clicked) rather than
  // keeping the full list loaded, so the dashboard load touches just /summary
  // and the current table page. Covers every payment matching the active status
  // filter, not only the visible page.
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Hits the role-restricted export endpoint. The server returns 403 if the
      // role may not export (handled below) — the hidden CTA is only the first,
      // non-authoritative line of defence.
      const data = await queryClient.fetchQuery(
        paymentsExportQuery.options({
          status: status === "all" ? undefined : status,
        }),
      );
      const rows = data.payments ?? [];
      if (rows.length === 0) {
        toast({
          variant: "info",
          title: "Nothing to export",
          description: "No payments match the current filter.",
        });
        return;
      }
      downloadCsv(rows);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      // Defensive: a role without export permission reaching here (e.g. a
      // tampered client) gets a clear message, not a silent failure.
      if (err instanceof ApiError && err.status === 403) {
        toast({
          variant: "error",
          title: "Not permitted",
          description: "Your role can't export payments.",
        });
        return;
      }
      toast({
        variant: "error",
        title: "Export failed",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setExporting(false);
    }
  }, [queryClient, status, toast, logout]);

  if (!ready || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="size-6 text-brand-600" />
      </div>
    );
  }

  return (
    <DashboardShell user={user} onLogout={logout}>
      <PaymentsHeader
        updatedLabel={updatedLabel}
        refreshing={summaryQuery.isRefetching || tableQuery.isRefetching}
        onRefresh={handleRefresh}
        onExport={handleExport}
        exportDisabled={exportableCount === 0 || exporting}
        canExport={canExport}
      />

      <PaymentsHero summary={summary} loading={summaryQuery.isPending} />

      <RecentPayments
        payments={tablePayments}
        meta={tableMeta}
        onPageChange={setPage}
        summary={summary}
        status={status}
        onStatusChange={handleStatusChange}
        search={search}
        onSearchChange={handleSearchChange}
        loading={tableQuery.isPending}
        isFetching={tableQuery.isFetching}
      />
    </DashboardShell>
  );
}
