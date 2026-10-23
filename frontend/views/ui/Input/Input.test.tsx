import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./index";

describe("Input", () => {
  it("associates the label with the input via id", () => {
    render(<Input id="email" label="Email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("id", "email");
  });

  it("accepts typed input", async () => {
    render(<Input id="name" label="Name" />);
    const input = screen.getByLabelText("Name");
    await userEvent.type(input, "Rina");
    expect(input).toHaveValue("Rina");
  });

  it("renders an error message and wires aria attributes", () => {
    render(<Input id="email" label="Email" error="Email is required." />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-error");
    const error = screen.getByText("Email is required.");
    expect(error).toHaveAttribute("id", "email-error");
  });

  it("renders leading icon and trailing content", () => {
    render(
      <Input
        id="pw"
        label="Password"
        leadingIcon={<span data-testid="lead" />}
        trailing={<button data-testid="toggle">show</button>}
      />,
    );
    expect(screen.getByTestId("lead")).toBeInTheDocument();
    expect(screen.getByTestId("toggle")).toBeInTheDocument();
  });

  it("does not set aria-invalid when there is no error", () => {
    render(<Input id="email" label="Email" />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
  });
});
