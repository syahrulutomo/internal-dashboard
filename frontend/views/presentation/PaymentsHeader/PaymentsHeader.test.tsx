import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentsHeader } from "./index";

function setup(overrides = {}) {
  const props = {
    updatedLabel: "2 min ago",
    onRefresh: vi.fn(),
    onExport: vi.fn(),
    // Default to a role that may export so the export-focused cases below see
    // the button; the hiding behaviour is covered by its own test.
    canExport: true,
    ...overrides,
  };
  render(<PaymentsHeader {...props} />);
  return props;
}

describe("PaymentsHeader", () => {
  it("renders the title and the updated label", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Payments" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Updated 2 min ago/)).toBeInTheDocument();
  });

  it("hides the updated label when null", () => {
    setup({ updatedLabel: null });
    expect(screen.queryByText(/Updated/)).toBeNull();
  });

  it("calls onRefresh and onExport", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await userEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
    expect(props.onExport).toHaveBeenCalledTimes(1);
  });

  it("disables the refresh button while refreshing", () => {
    setup({ refreshing: true });
    expect(screen.getByRole("button", { name: /refresh/i })).toBeDisabled();
  });

  it("disables the export button when exportDisabled is set", () => {
    setup({ exportDisabled: true });
    expect(screen.getByRole("button", { name: /export csv/i })).toBeDisabled();
  });

  it("hides the export CTA when the role may not export (canExport=false)", () => {
    setup({ canExport: false });
    expect(
      screen.queryByRole("button", { name: /export csv/i }),
    ).toBeNull();
    // The rest of the header is unaffected.
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
  });
});
