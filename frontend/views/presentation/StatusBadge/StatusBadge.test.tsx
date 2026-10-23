import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./index";
import type { PaymentStatus } from "@/libs/types";

describe("StatusBadge", () => {
  it("renders a human label for each known status", () => {
    const { rerender } = render(<StatusBadge status="completed" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();

    rerender(<StatusBadge status="processing" />);
    expect(screen.getByText("Processing")).toBeInTheDocument();

    rerender(<StatusBadge status="failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("falls back to the processing style for an unknown status", () => {
    // Defensive path: a status outside the union (e.g. a value the API adds
    // later) renders as "Processing" rather than crashing.
    render(<StatusBadge status={"refunded" as PaymentStatus} />);
    expect(screen.getByText("Processing")).toBeInTheDocument();
  });
});
