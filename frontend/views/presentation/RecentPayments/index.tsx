"use client";

import { Card } from "@/views/ui/Card";
import { Skeleton } from "@/views/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/views/ui/Table";
import { StatusBadge } from "../StatusBadge";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "@/views/ui/Icons";
import { cn } from "@/libs/cn";
import { formatCurrency, formatDateWIB, formatTimeWIB } from "@/libs/format";
import {
  PAYMENT_STATUSES,
  type PaginationMeta,
  type Payment,
  type PaymentStatus,
  type PaymentsSummary,
} from "@/libs/types";

export type StatusFilterValue = PaymentStatus | "all";

interface RecentPaymentsProps {
  payments: Payment[];
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  summary: PaymentsSummary | null;
  status: StatusFilterValue;
  onStatusChange: (status: StatusFilterValue) => void;
  search: string;
  onSearchChange: (value: string) => void;
  loading?: boolean;
  isFetching?: boolean;
}

const TAB_LABELS: Record<StatusFilterValue, string> = {
  all: "All",
  completed: "Completed",
  processing: "Processing",
  failed: "Failed",
};

function tabCount(summary: PaymentsSummary | null, value: StatusFilterValue) {
  if (!summary) return undefined;
  return value === "all" ? summary.total : summary[value];
}

// First letters of the merchant's first two words, e.g. "Batik Arunika" -> "BA".
function merchantInitials(merchant: string): string {
  const parts = merchant.split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || merchant.slice(0, 2)).toUpperCase();
}

export function RecentPayments({
  payments,
  meta,
  onPageChange,
  summary,
  status,
  onStatusChange,
  search,
  onSearchChange,
  loading,
  isFetching,
}: RecentPaymentsProps) {
  // Search is applied server-side (the container round-trips it to the API), so
  // `payments` already holds the matching page — just track whether a search is
  // active to pick the right empty-state message.
  const hasSearch = search.trim().length > 0;

  const subtitle =
    status === "all"
      ? "All statuses · sorted by date, descending"
      : `${TAB_LABELS[status]} · sorted by date, descending`;

  const tabs: StatusFilterValue[] = ["all", ...PAYMENT_STATUSES];

  return (
    <Card className="overflow-hidden">
      {/* Header: title + tabs + search */}
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent payments
            </h2>
            {isFetching && !loading && (
              <span className="text-xs text-[var(--muted)]">Updating…</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div
            role="tablist"
            aria-label="Filter payments by status"
            className="inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1"
          >
            {tabs.map((tab) => {
              const active = tab === status;
              const count = tabCount(summary, tab);
              return (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={active}
                  onClick={() => onStatusChange(tab)}
                  className={cn(
                    "cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-900",
                  )}
                >
                  {TAB_LABELS[tab]}
                  {count !== undefined && (
                    <span
                      className={cn(
                        "ml-1.5 tabular-nums",
                        active ? "text-gray-400" : "text-gray-400",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search ID or merchant"
              aria-label="Search payments by ID or merchant"
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-2 focus:outline-brand-500/25 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Payment ID</TableHeaderCell>
              <TableHeaderCell>Merchant name</TableHeaderCell>
              <TableHeaderCell sortable>Date</TableHeaderCell>
              <TableHeaderCell align="right" sortable>
                Amount
              </TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center">
                  <p className="text-sm font-medium text-gray-900">
                    No payments found
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {hasSearch
                      ? "No results match your search."
                      : "Try a different status filter."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id} className="hover:bg-gray-50/70">
                  <TableCell className="font-mono text-xs tracking-wide text-gray-500">
                    {payment.id}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                        {merchantInitials(payment.merchant)}
                      </span>
                      <span className="font-medium text-gray-900">
                        {payment.merchant}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="leading-tight">
                      <p className="text-gray-900">
                        {formatDateWIB(payment.created_at)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatTimeWIB(payment.created_at)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 border-t border-[var(--border)] px-6 py-4 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>{countLabel(loading, payments.length, meta)}</span>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          {meta && (
            <Pagination
              meta={meta}
              onPageChange={onPageChange}
              disabled={isFetching}
            />
          )}
          <span>Amounts in IDR · times in WIB</span>
        </div>
      </div>
    </Card>
  );
}

// Builds the "Showing …" summary line from the server-side pagination metadata.
// Filtering (status and search) is applied server-side, so `meta.total` already
// reflects the filtered count and the range is derived directly from it.
function countLabel(
  loading: boolean | undefined,
  pageCount: number,
  meta?: PaginationMeta,
): string {
  if (loading) return "Loading payments…";
  if (!meta || meta.total === 0) return "No payments";
  const start = (meta.page - 1) * meta.per_page + 1;
  const end = start + pageCount - 1;
  return `Showing ${start}–${end} of ${meta.total} payments`;
}

// Windowed list of page numbers with ellipses for large page counts, e.g.
// [1, "…", 4, 5, 6, "…", 12]. Small page counts are shown in full.
function pageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("…");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push("…");
  items.push(total);
  return items;
}

function Pagination({
  meta,
  onPageChange,
  disabled,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const { page, total_pages } = meta;
  if (total_pages <= 1) return null;

  const go = (p: number) => {
    if (p < 1 || p > total_pages || p === page) return;
    onPageChange(p);
  };

  return (
    <nav aria-label="Payments pagination" className="flex items-center gap-1">
      <PageButton
        aria-label="Previous page"
        disabled={disabled || page <= 1}
        onClick={() => go(page - 1)}
      >
        <ChevronLeftIcon className="size-4" />
      </PageButton>
      {pageItems(page, total_pages).map((item, i) =>
        item === "…" ? (
          <span
            key={`gap-${i}`}
            aria-hidden="true"
            className="select-none px-1 text-gray-400"
          >
            …
          </span>
        ) : (
          <PageButton
            key={item}
            aria-label={`Page ${item}`}
            aria-current={item === page ? "page" : undefined}
            active={item === page}
            disabled={disabled}
            onClick={() => go(item)}
          >
            {item}
          </PageButton>
        ),
      )}
      <PageButton
        aria-label="Next page"
        disabled={disabled || page >= total_pages}
        onClick={() => go(page + 1)}
      >
        <ChevronRightIcon className="size-4" />
      </PageButton>
    </nav>
  );
}

function PageButton({
  children,
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "cursor-pointer grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-brand-600 text-white"
          : "text-gray-600 hover:bg-gray-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-24 rounded-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
