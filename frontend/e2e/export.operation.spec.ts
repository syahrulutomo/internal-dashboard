import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { STORAGE_STATE_CS, STORAGE_STATE_OP, TOKEN_KEY } from "./fixtures";

const API_BASE_URL = "http://localhost:8080";
const EXPORT_PATH = "/dashboard/v1/payments/export";

// Reads the bearer token a setup project persisted to a storageState file. The
// app stores the session as a cookie whose value is URL-encoded JSON
// ({email, role, token}); storageState captures it under `cookies`.
function tokenFromState(statePath: string): string {
  const state = JSON.parse(readFileSync(statePath, "utf8")) as {
    cookies: { name: string; value: string }[];
  };
  const cookie = state.cookies.find((c) => c.name === TOKEN_KEY);
  if (!cookie) throw new Error(`no ${TOKEN_KEY} cookie in ${statePath}`);
  const session = JSON.parse(decodeURIComponent(cookie.value)) as {
    token: string;
  };
  return session.token;
}

test.describe("payments export (operation role)", () => {
  test("shows the Export CTA and downloads a CSV", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Recent payments" }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /durianpay-payments-\d{4}-\d{2}-\d{2}\.csv/,
    );
  });
});

// The UI gate is cosmetic; these assertions prove the *server* is the real
// authorization boundary by calling the export endpoint directly with each
// role's token (no browser, no hidden button to bypass).
test.describe("payments export API enforcement", () => {
  test("operation token is authorized (200)", async ({ request }) => {
    const res = await request.get(API_BASE_URL + EXPORT_PATH, {
      headers: { Authorization: `Bearer ${tokenFromState(STORAGE_STATE_OP)}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.payments)).toBe(true);
  });

  test("cs token is forbidden (403)", async ({ request }) => {
    const res = await request.get(API_BASE_URL + EXPORT_PATH, {
      headers: { Authorization: `Bearer ${tokenFromState(STORAGE_STATE_CS)}` },
    });
    expect(res.status()).toBe(403);
  });

  test("no token is unauthorized (401)", async ({ request }) => {
    const res = await request.get(API_BASE_URL + EXPORT_PATH);
    expect(res.status()).toBe(401);
  });
});
