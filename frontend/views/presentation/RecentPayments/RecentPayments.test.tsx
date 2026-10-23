import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecentPayments } from "./index";
import type {
  PaginationMeta,
  Payment,
  PaymentsSummary,
} from "@/libs/types";

const payments: Payment[] = [
  {
    id: "PAY-0001",
    merchant: "Batik Arunika",
    status: "completed",
    amount: "150000.00",
    created_at: "2026-01-01T03:00:00Z",
  },
  {
    id: "PAY-0002",
    merchant: "Kopi Senja",
    status: "failed",
    amount: "50000.00",
    created_at: "2026-01-02T03:00:00Z",
  },
];

const summary: PaymentsSummary = {
  total: 48,
  completed: 30,
  processing: 10,
  failed: 8,
  totalAmount: 1_000_000,
  amountByStatus: { completed: 700_000, processing: 200_000, failed: 100_000 },
};

const meta: PaginationMeta = {
  page: 1,
  per_page: 10,
  total: 2,
  total_pages: 1,
};

function setup(overrides = {}) {
  const props = {
    payments,
    meta,
    onPageChange: vi.fn(),
    summary,
    status: "all" as const,
    onStatusChange: vi.fn(),
    search: "",
    onSearchChange: vi.fn(),
    ...overrides,
  };
  render(<RecentPayments {...props} />);
  return props;
}

describe("RecentPayments", () => {
  it("renders a row per payment with id, merchant and formatted amount", () => {
    setup();
    expect(screen.getByText("PAY-0001")).toBeInTheDocument();
    expect(screen.getByText("Batik Arunika")).toBeInTheDocument();
    expect(screen.getByText("Rp 150.000")).toBeInTheDocument();
    expect(screen.getByText("Kopi Senja")).toBeInTheDocument();
  });

  it("shows the server-side count label from pagination meta", () => {
    setup();
    expect(
      screen.getByText("Showing 1–2 of 2 payments"),
    ).toBeInTheDocument();
  });

  it("renders skeleton rows while loading", () => {
    const { container } = render(
      <RecentPayments
        payments={[]}
        meta={meta}
        onPageChange={vi.fn()}
        summary={summary}
        status="all"
        onStatusChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        loading
      />,
    );
    expect(screen.getByText("Loading payments…")).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });

  it("shows the filter empty state when there are no payments and no search", () => {
    setup({ payments: [], meta: { ...meta, total: 0 }, search: "" });
    expect(screen.getByText("No payments found")).toBeInTheDocument();
    expect(screen.getByText("Try a different status filter.")).toBeInTheDocument();
  });

  it("shows the search empty state when a search yields nothing", () => {
    setup({ payments: [], meta: { ...meta, total: 0 }, search: "zzz" });
    expect(screen.getByText("No results match your search.")).toBeInTheDocument();
  });

  it("renders status tabs with counts and reports tab changes", async () => {
    const props = setup();
    const tablist = screen.getByRole("tablist");
    const failedTab = within(tablist).getByRole("tab", { name: /Failed/ });
    expect(failedTab).toHaveTextContent("8"); // summary.failed
    await userEvent.click(failedTab);
    expect(props.onStatusChange).toHaveBeenCalledWith("failed");
  });

  it("reports search input changes", async () => {
    const props = setup();
    await userEvent.type(
      screen.getByRole("searchbox", { name: /search payments/i }),
      "a",
    );
    expect(props.onSearchChange).toHaveBeenCalledWith("a");
  });

  it("renders pagination and navigates pages when there are multiple", async () => {
    const props = setup({
      meta: { page: 1, per_page: 10, total: 25, total_pages: 3 },
    });
    const nav = screen.getByRole("navigation", { name: /pagination/i });
    expect(within(nav).getByLabelText("Previous page")).toBeDisabled();
    await userEvent.click(within(nav).getByLabelText("Next page"));
    expect(props.onPageChange).toHaveBeenCalledWith(2);
  });
});
