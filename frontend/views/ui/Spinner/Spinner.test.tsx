import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "./index";

describe("Spinner", () => {
  it("exposes an accessible loading status", () => {
    render(<Spinner />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Loading");
  });

  it("merges a custom className", () => {
    render(<Spinner className="size-4" />);
    expect(screen.getByRole("status").className).toContain("size-4");
  });
});
