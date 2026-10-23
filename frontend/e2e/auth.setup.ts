import { test as setup, expect, type Page } from "@playwright/test";
import {
  CS_USER,
  OPERATION_USER,
  STORAGE_STATE_CS,
  STORAGE_STATE_OP,
} from "./fixtures";

// Signs in once per role via the real UI and saves each session (the bearer
// token lives in localStorage, which `storageState` captures per origin). The
// role-specific specs reuse these, so the whole suite spends just two logins
// against the IP-scoped rate limiter.
async function signIn(
  page: Page,
  user: { email: string; password: string },
  statePath: string,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL("**/dashboard");
  await expect(
    page.getByRole("heading", { name: "Recent payments" }),
  ).toBeVisible();

  await page.context().storageState({ path: statePath });
}

setup("authenticate as CS", async ({ page }) => {
  await signIn(page, CS_USER, STORAGE_STATE_CS);
});

setup("authenticate as Operation", async ({ page }) => {
  await signIn(page, OPERATION_USER, STORAGE_STATE_OP);
});
