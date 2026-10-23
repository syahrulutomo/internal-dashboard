import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The page is a thin route wrapper, so the container is mocked out to keep this
// a true unit test (no react-query / auth / network wiring pulled in).
vi.mock("@/views/container/DashboardContainer", () => ({
  DashboardContainer: () => <div data-testid="dashboard-container" />,
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
  it("renders the dashboard container", () => {
    render(<DashboardPage />);
    expect(screen.getByTestId("dashboard-container")).toBeInTheDocument();
  });
});
