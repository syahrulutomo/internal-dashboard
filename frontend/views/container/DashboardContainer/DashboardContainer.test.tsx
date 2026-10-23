import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/views/presentation/Toaster";
import {
  clearAuth,
  getAuthSnapshot,
  getToken,
  saveAuth,
} from "@/libs/auth-storage";
import { DashboardContainer } from "./index";
import type { AuthUser } from "@/libs/types";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const user: AuthUser = { email: "cs@test.com", role: "cs", token: "jwt-123" };

const summaryWire = {
  total: 48,
  completed: 30,
  processing: 10,
  failed: 8,
  total_amount: "1250000.00",
  amount_by_status: {
    completed: "700000.00",
    processing: "400000.00",
    failed: "150000.00",
  },
};

const paymentsResponse = {
  payments: [
    {
      id: "PAY-0001",
      merchant: "Batik Arunika",
      status: "completed",
      amount: "175500.00",
      created_at: "2026-01-01T03:00:00Z",
    },
  ],
  meta: { page: 1, per_page: 10, total: 48, total_pages: 5 },
};

const fetchMock = vi.fn();

function ok(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

// Routes fetch calls to the right fixture by URL.
function routeByUrl(url: unknown) {
  const u = String(url);
  // /auth/me mirrors the current session so the container's role-sync is a no-op.
  if (u.includes("/auth/me")) {
    const session = getAuthSnapshot() ?? user;
    return Promise.resolve(ok({ email: session.email, role: session.role }));
  }
  if (u.includes("/payments/summary")) return Promise.resolve(ok(summaryWire));
  if (u.includes("/payments")) return Promise.resolve(ok(paymentsResponse));
  return Promise.reject(new Error(`unexpected url: ${u}`));
}

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>
          <DashboardContainer />
          <Toaster />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(routeByUrl);
  replace.mockReset();
  clearAuth();
  window.localStorage.clear();
  // Authenticated session so the protected guard lets the dashboard render.
  saveAuth(user);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DashboardContainer", () => {
  it("renders the shell, summary and payments once data loads", async () => {
    // The summary hero is gated on payments:summary (operation only), so sign in
    // as operation to assert its widgets.
    saveAuth({ ...user, role: "operation" });
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Payments" }),
    ).toBeInTheDocument();
    // Summary-driven widgets.
    expect(await screen.findByText("Batik Arunika")).toBeInTheDocument();
    expect(await screen.findByText("Total payments")).toBeInTheDocument();
    // Total volume (hero) comes from the summary's mapped amount.
    expect(screen.getByText("Rp 1.250.000")).toBeInTheDocument();
    // Row amount formatted to IDR.
    expect(screen.getByText("Rp 175.500")).toBeInTheDocument();
  });

  it("hides the summary hero for a cs role (RBAC)", async () => {
    // beforeEach seeds a cs session, which lacks payments:summary.
    renderDashboard();
    await screen.findByText("Batik Arunika");

    expect(screen.queryByText("Total payments")).toBeNull();
    // The hero's total-volume figure is absent too.
    expect(screen.queryByText("Rp 1.250.000")).toBeNull();
  });

  it("refetches both queries when Refresh is clicked", async () => {
    renderDashboard();
    await screen.findByText("Batik Arunika");

    const callsBefore = fetchMock.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it("logs out and clears the session when Log out is clicked", async () => {
    renderDashboard();
    await screen.findByText("Batik Arunika");

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    await waitFor(() => expect(getToken()).toBeNull());
  });

  it("logs out on a 401 from a protected call", async () => {
    // Operation role so the summary call (gated on payments:summary) actually
    // fires and can return the 401 under test.
    saveAuth({ ...user, role: "operation" });
    fetchMock.mockImplementation((url: unknown) => {
      const u = String(url);
      if (u.includes("/payments/summary")) {
        return Promise.resolve({
          ok: false,
          status: 401,
          text: async () => "",
          json: async () => ({ message: "unauthorized" }),
        });
      }
      return routeByUrl(url);
    });

    renderDashboard();
    await waitFor(() => expect(getToken()).toBeNull());
  });

  it("hides the export CTA for a cs role (RBAC)", async () => {
    // beforeEach seeds a cs session, which may not export.
    renderDashboard();
    await screen.findByText("Batik Arunika");

    expect(
      screen.queryByRole("button", { name: /export csv/i }),
    ).toBeNull();
  });

  it("exports a CSV of the filtered rows for an operation role", async () => {
    // Only the operation role may export, so sign in as one for this flow.
    saveAuth({ ...user, role: "operation" });

    // jsdom lacks the object-URL APIs the export path uses — add them to the
    // real URL (keeping its constructor, which the API client relies on).
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    const urlAny = URL as unknown as Record<string, unknown>;
    urlAny.createObjectURL = createObjectURL;
    urlAny.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      renderDashboard();
      await screen.findByText("Batik Arunika");

      // The Export CTA appears once the async RBAC check resolves for the
      // operation role.
      await userEvent.click(
        await screen.findByRole("button", { name: /export csv/i }),
      );

      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
      expect(clickSpy).toHaveBeenCalled();
      // Export must hit the role-restricted endpoint, not the list endpoint.
      expect(
        fetchMock.mock.calls.some((c) =>
          String(c[0]).includes("/payments/export"),
        ),
      ).toBe(true);
    } finally {
      clickSpy.mockRestore();
      delete urlAny.createObjectURL;
      delete urlAny.revokeObjectURL;
    }
  });
});
