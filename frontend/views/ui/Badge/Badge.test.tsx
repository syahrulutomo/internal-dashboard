import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./index";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("applies the tone classes for the given tone", () => {
    render(<Badge tone="danger">Failed</Badge>);
    const badge = screen.getByText("Failed");
    expect(badge.className).toContain("text-red-700");
  });

  it("merges a custom className", () => {
    render(<Badge className="custom-class">Tagged</Badge>);
    expect(screen.getByText("Tagged").className).toContain("custom-class");
  });
});
