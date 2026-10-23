import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "./error";

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // The boundary logs the error on mount for observability — silence it.
  consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe("Error boundary", () => {
  it("renders a recovery message in an alert region", () => {
    render(<ErrorBoundary error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("logs the error for observability", () => {
    const err = new Error("boom");
    render(<ErrorBoundary error={err} reset={vi.fn()} />);
    expect(consoleSpy).toHaveBeenCalledWith("Unhandled UI error:", err);
  });

  it("calls reset when the user clicks Try again", async () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={new Error("boom")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
