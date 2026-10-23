import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBanner } from "./index";

describe("ErrorBanner", () => {
  it("renders the message in an alert role", () => {
    render(<ErrorBanner message="Something went wrong" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
  });

  it("does not render a retry button when no handler is given", () => {
    render(<ErrorBanner message="Oops" />);
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("renders a retry button that calls onRetry", async () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Oops" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
