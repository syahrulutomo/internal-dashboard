import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./index";

describe("Sidebar", () => {
  it("renders the product chrome and the Payments nav item", () => {
    render(<Sidebar />);
    expect(screen.getByText("DurianPay Internal")).toBeInTheDocument();
    expect(screen.getByText("Monitoring")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
  });

  it("marks the Payments item as the current page", () => {
    render(<Sidebar />);
    expect(screen.getByText("Payments")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
