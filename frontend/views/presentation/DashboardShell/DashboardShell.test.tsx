import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardShell } from "./index";
import type { AuthUser } from "@/libs/types";

const user: AuthUser = {
  email: "ops.lead@test.com",
  role: "operation",
  token: "tok",
};

describe("DashboardShell", () => {
  it("renders the user chrome and the content children", () => {
    render(
      <DashboardShell user={user} onLogout={vi.fn()}>
        <div data-testid="content">Payments content</div>
      </DashboardShell>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
    // Topbar derives "Ops Lead" from ops.lead@test.com.
    expect(screen.getByText("Ops Lead")).toBeInTheDocument();
  });

  it("wires the Topbar logout through to onLogout", async () => {
    const onLogout = vi.fn();
    render(
      <DashboardShell user={user} onLogout={onLogout}>
        <div />
      </DashboardShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
