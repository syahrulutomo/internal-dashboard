import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./index";

describe("LoginForm", () => {
  it("shows validation errors and does not submit when fields are empty", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed credentials when valid", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("Email"), "  cs@test.com  ");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: "cs@test.com",
      password: "password",
    });
  });

  it("toggles password visibility", async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");

    await userEvent.click(
      screen.getByRole("button", { name: /show password/i }),
    );
    expect(password.type).toBe("text");
  });

  it("locks the form and shows the cooldown label while disabled", async () => {
    const onSubmit = vi.fn();
    render(
      <LoginForm
        onSubmit={onSubmit}
        disabled
        cooldownLabel="Try again in 4:59"
      />,
    );

    const submit = screen.getByRole("button", { name: /try again in 4:59/i });
    expect(submit).toBeDisabled();

    // Submitting while disabled must not call through.
    await userEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
