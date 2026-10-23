import { test, expect } from "@playwright/test";
import { CS_USER, SEED } from "./fixtures";

// Dashboard journeys for an already-authenticated CS user. The session comes
// from `auth.setup.ts` via storageState, so none of these spend a login attempt
// against the rate limiter. Assertions key off the deterministic seed (SEED).

test.beforeEach(async ({ page }) => {
  await page.goto("/dashboard");
  // Gate every test on the table being rendered (summary + first page loaded).
  await expect(
    page.getByRole("heading", { name: "Recent payments" }),
  ).toBeVisible();
});

test("renders the signed-in user, summary and first page of payments", async ({
  page,
}) => {
  // Identity, from the Topbar. For cs@test.com the derived display name and the
  // role label are both "Cs", so assert presence (first match) plus the logout
  // control that only the authenticated shell renders.
  await expect(page.getByText(CS_USER.displayName).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  // The status filter tabs are present (labels only — no count badge).
  await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Completed" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Processing" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Failed" })).toBeVisible();

  // The summary hero (with its per-status counts) is gated on the
  // `payments:summary` permission, which the cs role does NOT hold — so it is
  // never rendered here. Those counts are asserted in the operation spec.
  await expect(page.getByText("Total payments")).toHaveCount(0);

  // First page of the table: 10 rows of a 48-row dataset.
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(SEED.pageSize + 1); // + header row
  // The dash is an en-dash in the UI; "." keeps the matcher encoding-agnostic.
  await expect(page.getByText(/Showing 1.10 of 48 payments/)).toBeVisible();
});

test("filtering by a status tab narrows rows and resets to page one", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Completed" }).click();

  // The footer count follows the filtered total, and the page resets to 1.
  await expect(page.getByText(/Showing 1.10 of 30 payments/)).toBeVisible();

  // Every visible status cell must read "Completed" — none Processing/Failed.
  const table = page.getByRole("table");
  await expect(table.getByRole("cell", { name: "Completed" })).toHaveCount(
    SEED.pageSize,
  );
  await expect(table.getByRole("cell", { name: "Processing" })).toHaveCount(0);
  await expect(table.getByRole("cell", { name: "Failed" })).toHaveCount(0);

  // The active tab is reflected to assistive tech.
  await expect(page.getByRole("tab", { name: "Completed" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("searching by merchant filters server-side (debounced)", async ({
  page,
}) => {
  const search = page.getByRole("searchbox", {
    name: "Search payments by ID or merchant",
  });
  await search.fill("Acme");

  // Web-first assertion absorbs the 300ms debounce + round-trip, no fixed wait.
  // "Acme Corp" is seeded 4 times across the 48 rows.
  await expect(page.getByText(/of 4 payments/)).toBeVisible();

  const table = page.getByRole("table");
  await expect(table.getByRole("cell", { name: "Acme Corp" })).toHaveCount(4);
  await expect(table.getByRole("cell", { name: "Globex" })).toHaveCount(0);

  // A query that matches nothing shows the explicit empty state.
  await search.fill("zzzz-no-such-merchant");
  await expect(
    page.getByText("No results match your search."),
  ).toBeVisible();
});

test("pagination advances to the next page of results", async ({ page }) => {
  await page
    .getByRole("navigation", { name: "Payments pagination" })
    .getByRole("button", { name: "Next page" })
    .click();

  await expect(page.getByText(/Showing 11.20 of 48 payments/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Page 2" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("does not show the Export CSV CTA for the cs role (RBAC)", async ({
  page,
}) => {
  // Export is restricted to the operation role; the CS dashboard must not render
  // the CTA at all. (The server also enforces this — see the operation spec.)
  await expect(
    page.getByRole("button", { name: "Export CSV" }),
  ).toHaveCount(0);
  // The rest of the header toolbar is still present.
  await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
});

test("logging out returns to /login and re-guards the dashboard", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The session is gone, so a direct dashboard visit bounces straight back.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
