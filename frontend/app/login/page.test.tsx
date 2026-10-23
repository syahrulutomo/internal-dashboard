import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The page is a thin route wrapper, so the container is mocked out to keep this
// a true unit test (no react-query / auth / network wiring pulled in).
vi.mock("@/views/container/LoginContainer", () => ({
  LoginContainer: () => <div data-testid="login-container" />,
}));

import LoginPage from "./page";

describe("LoginPage", () => {
  it("renders the login container", () => {
    render(<LoginPage />);
    expect(screen.getByTestId("login-container")).toBeInTheDocument();
  });
});
