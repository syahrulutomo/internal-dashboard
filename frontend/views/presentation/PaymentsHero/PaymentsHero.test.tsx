import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentsHero } from "./index";
import type { PaymentsSummary } from "@/libs/types";

const summary: PaymentsSummary = {
  total: 10,
  completed: 7,
  processing: 2,
  failed: 1,
  totalAmount: 1_000_000,
  amountByStatus: { completed: 700_000, processing: 200_000, failed: 100_000 },
};

describe("PaymentsHero", () => {
  it("renders a placeholder while loading", () => {
    const { container } = render(<PaymentsHero summary={null} loading />);
    expect(screen.queryByText("Total payments")).toBeNull();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("renders a placeholder when the summary is null", () => {
    render(<PaymentsHero summary={null} />);
    expect(screen.queryByText("Total payments")).toBeNull();
  });

  it("renders totals, volume and success rate", () => {
    render(<PaymentsHero summary={summary} />);
    expect(screen.getByText("Total payments")).toBeInTheDocument();
    expect(screen.getByText("Rp 1.000.000")).toBeInTheDocument();
    expect(screen.getByText("Success rate")).toBeInTheDocument();
    // success rate = 7 / 10 = 70% (also shown as the completed share)
    expect(screen.getAllByText("70%").length).toBeGreaterThan(0);
  });

  it("renders a label for each status", () => {
    render(<PaymentsHero summary={summary} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders the amount of each status", () => {
    render(<PaymentsHero summary={summary} />);
    expect(screen.getByText("Rp 700.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 200.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 100.000")).toBeInTheDocument();
  });

  it("renders the percentage share of each status", () => {
    render(<PaymentsHero summary={summary} />);
    // completed 70% (shared with success rate), processing 20%, failed 10%
    expect(screen.getAllByText("70%").length).toBeGreaterThan(0);
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
  });
});
