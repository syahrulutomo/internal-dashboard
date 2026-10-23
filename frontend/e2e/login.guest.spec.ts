import { test, expect } from "@playwright/test";
import { CS_USER, TOKEN_KEY } from "./fixtures";

// Signed-out journeys: route guards, the login form, and session invalidation.
// These run without a stored session (the "guest" project).

test.describe("route guards", () => {
  test("visiting /dashboard while signed out redirects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("the root path routes an anonymous user to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("login form", () => {
  test("submitting an empty form shows inline validation and makes no request", async ({
    page,
  }) => {
    // Assert on the network: client-side validation must short-circuit before
    // any call to the login endpoint (and so spends no rate-limit budget).
    let loginCalled = false;
    page.on("request", (req) => {
      if (req.url().includes("/auth/login")) loginCalled = true;
    });

    await page.goto("/login");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(loginCalled).toBe(false);
  });

  test("invalid credentials surface an error toast and keep the user on /login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(CS_USER.email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Scope to the toast text — `role="alert"` alone also matches Next.js's
    // empty route announcer.
    await expect(page.getByText("Sign in failed")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("valid credentials sign the user in and land on the dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(CS_USER.email);
    await page.getByLabel("Password", { exact: true }).fill(CS_USER.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    // The authenticated shell rendered: the payments table and the Topbar's
    // logout control (the latter only exists for a signed-in user).
    await expect(
      page.getByRole("heading", { name: "Recent payments" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });
});

test("a tampered/expired token is rejected and forces a re-login", async ({
  page,
  context,
}) => {
  // Seed a syntactically-plausible but invalid session cookie (the app persists
  // the session as a cookie). The first protected call returns 401, which the
  // dashboard container turns into an automatic logout back to /login.
  await context.addCookies([
    {
      name: TOKEN_KEY,
      value: encodeURIComponent(
        JSON.stringify({
          email: CS_USER.email,
          role: "cs",
          token: "not-a-real-jwt",
        }),
      ),
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
