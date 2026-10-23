import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./index";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Panel body</Card>);
    expect(screen.getByText("Panel body")).toBeInTheDocument();
  });

  it("merges a custom className with the base classes", () => {
    render(<Card className="p-6">Body</Card>);
    const el = screen.getByText("Body");
    expect(el.className).toContain("p-6");
    expect(el.className).toContain("rounded-2xl");
  });

  it("forwards arbitrary div attributes", () => {
    render(<Card data-testid="card" aria-label="Summary" />);
    expect(screen.getByTestId("card")).toHaveAttribute("aria-label", "Summary");
  });
});
