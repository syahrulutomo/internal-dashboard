import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./index";

describe("StatusBadge", () => {
  it("renders a human label for each known status", () => {
    const { rerender } = render(<StatusBadge status="completed" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();

    rerender(<StatusBadge status="processing" />);
    expect(screen.getByText("Processing")).toBeInTheDocument();

    rerender(<StatusBadge status="failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
