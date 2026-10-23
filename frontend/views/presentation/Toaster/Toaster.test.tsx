import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast, type ToastInput } from "@/hooks/use-toast";
import { Toaster } from "./index";

// Harness: a button that raises a configurable toast, rendered alongside the
// Toaster inside a shared provider so they share state.
function Harness({ input }: { input: ToastInput }) {
  const { toast } = useToast();
  return (
    <>
      <button onClick={() => toast(input)}>raise</button>
      <Toaster />
    </>
  );
}

function renderHarness(input: ToastInput) {
  render(
    <ToastProvider>
      <Harness input={input} />
    </ToastProvider>,
  );
}

describe("Toaster", () => {
  it("renders nothing when there are no toasts", () => {
    const { container } = render(
      <ToastProvider>
        <Toaster />
      </ToastProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a raised toast with title and description", async () => {
    renderHarness({
      title: "Saved",
      description: "Your changes are saved",
      variant: "success",
      duration: 0,
    });
    await userEvent.click(screen.getByText("raise"));

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Your changes are saved")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses the alert role for error toasts", async () => {
    renderHarness({ title: "Boom", variant: "error", duration: 0 });
    await userEvent.click(screen.getByText("raise"));
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
  });

  it("dismisses a toast via its close button", async () => {
    renderHarness({ title: "Dismiss me", variant: "info", duration: 0 });
    await userEvent.click(screen.getByText("raise"));
    expect(screen.getByText("Dismiss me")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /dismiss notification/i }),
    );
    expect(screen.queryByText("Dismiss me")).toBeNull();
  });

  it("runs the action handler and dismisses when the action is clicked", async () => {
    const onClick = vi.fn();
    renderHarness({
      title: "Undo?",
      variant: "info",
      duration: 0,
      action: { label: "Undo", onClick },
    });
    await userEvent.click(screen.getByText("raise"));

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Undo?")).toBeNull();
  });
});
