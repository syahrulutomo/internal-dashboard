import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginHero } from "./index";

describe("LoginHero", () => {
  it("renders the branded heading and product name", () => {
    render(<LoginHero />);
    expect(screen.getByText("DurianPay Internal")).toBeInTheDocument();
    expect(
      screen.getByText("Every incoming payment, in one view."),
    ).toBeInTheDocument();
  });
});
