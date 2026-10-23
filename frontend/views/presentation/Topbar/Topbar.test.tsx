import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Topbar } from "./index";
import type { AuthUser } from "@/libs/types";

const user: AuthUser = {
  email: "rina.wijaya@durianpay.id",
  role: "operation",
  token: "tok",
};

describe("Topbar", () => {
  it("derives a display name and initials from the email", () => {
    render(<Topbar user={user} onLogout={vi.fn()} />);
    expect(screen.getByText("Rina Wijaya")).toBeInTheDocument();
    expect(screen.getByText("RW")).toBeInTheDocument();
  });

  it("renders a capitalized role label", () => {
    render(<Topbar user={user} onLogout={vi.fn()} />);
    expect(screen.getByText("Operation")).toBeInTheDocument();
  });

  it("calls onLogout when the log out button is clicked", async () => {
    const onLogout = vi.fn();
    render(<Topbar user={user} onLogout={onLogout} />);
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("falls back gracefully when the email yields no name", () => {
    // Degenerate email: the local-part produces no name parts, so displayName
    // falls back to the raw email ("") and initials to "?".
    render(
      <Topbar user={{ email: "", role: "cs", token: "tok" }} onLogout={vi.fn()} />,
    );
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
