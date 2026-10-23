import { describe, it, expect, vi, beforeEach } from "vitest";

// The root route is a server redirect; mock next/navigation so we can assert the
// target without a real router.
const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

import Home from "./page";

beforeEach(() => {
  redirect.mockReset();
});

describe("Home", () => {
  it("redirects to the dashboard", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
