import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./index";

describe("Skeleton", () => {
  it("renders an aria-hidden pulse placeholder", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden");
    expect(el.className).toContain("animate-pulse");
  });

  it("merges a custom className", () => {
    const { container } = render(<Skeleton className="h-9 w-16" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-9");
    expect(el.className).toContain("w-16");
  });
});
