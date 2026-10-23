import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./index";

describe("Button", () => {
  it("renders its children and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and shows a spinner while loading", () => {
    render(<Button loading>Submit</Button>);
    const button = screen.getByRole("button", { name: /submit/i });
    expect(button).toBeDisabled();
    // Spinner renders its own status role.
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Nope" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies variant styling", () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole("button").className).toContain("border");
  });

  it("forwards the native type attribute", () => {
    render(<Button type="submit">Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
