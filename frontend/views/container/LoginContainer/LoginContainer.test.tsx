import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/views/presentation/Toaster";
import { clearAuth, getToken } from "@/libs/auth-storage";
import { clearCooldown } from "@/libs/login-cooldown";
import { LoginContainer } from "./index";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const fetchMock = vi.fn();

// Builds a fetch Response stand-in.
function res({
  ok = true,
  status = 200,
  body = {},
}: {
  ok?: boolean;
  status?: number;
  body?: unknown;
}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

function renderLogin() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>
          <LoginContainer />
          <Toaster />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  replace.mockReset();
  clearAuth();
  clearCooldown();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginContainer", () => {
  it("renders the sign-in form for an unauthenticated visitor", () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("logs in, stores the session and redirects to the dashboard", async () => {
    const user = { email: "cs@test.com", role: "cs", token: "jwt-123" };
    fetchMock.mockResolvedValue(res({ body: user }));

    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "cs@test.com");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(getToken()).toBe("jwt-123");
  });

  it("shows an error toast when credentials are rejected", async () => {
    fetchMock.mockResolvedValue(
      res({ ok: false, status: 401, body: { message: "Invalid credentials" } }),
    );

    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "cs@test.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Sign in failed")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("starts a cooldown and locks the form on HTTP 429", async () => {
    fetchMock.mockResolvedValue(res({ ok: false, status: 429, body: {} }));

    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "cs@test.com");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Too many attempts")).toBeInTheDocument();
    // The submit button now shows the cooldown countdown and is disabled.
    const submit = await screen.findByRole("button", {
      name: /try again in/i,
    });
    expect(submit).toBeDisabled();
  });
});
