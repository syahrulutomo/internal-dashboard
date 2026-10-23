import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// End-to-end tests drive the *real* stack: the Go payments API and the Next.js
// dashboard, wired together exactly as in production. Playwright boots both via
// the `webServer` block below, so `pnpm test:e2e` is self-contained — no manual
// server juggling.
//
// Determinism: the backend seeds a fixed dataset (48 payments, users
// cs@test.com / operation@test.com) the first time its SQLite file is empty. We
// point DB_PATH at a throwaway file and delete it before boot, so every run
// starts from the same freshly-seeded state. See `backend/main.go#seedPayments`.
//
// Rate limiting: login is capped at a burst of 5 attempts per IP per 10-minute
// window (`backend/internal/service/http/server.go`). All tests share one IP
// (localhost), so real login attempts are a scarce budget — hence `retries: 0`
// and a single sign-in in `auth.setup.ts` whose session is reused by every
// authenticated spec.

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 8080;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;

const backendDir = path.resolve(__dirname, "../backend");
// Throwaway SQLite file, recreated (and reseeded) on every run.
const e2eDbPath = path.join(backendDir, "e2e.db");

// Env for the backend process. Setting these in the child's environment is what
// makes them take effect: `config` reads os.Getenv at init, and the stray
// backend/.env loaded later by godotenv.Load() does not override already-set
// vars. APP_ENV stays "development" so the test JWT secret isn't rejected by the
// production config guard.
const backendEnv = {
  APP_ENV: "development",
  JWT_SECRET: "e2e-test-secret-not-for-production-use-only",
  DB_PATH: e2eDbPath,
  HTTP_ADDR: `:${BACKEND_PORT}`,
  CORS_ALLOWED_ORIGINS: BASE_URL,
  CGO_ENABLED: "1",
};

export default defineConfig({
  testDir: "./e2e",
  // Isolated from Vitest, which owns `**/*.test.{ts,tsx}`. Keeping e2e under
  // `./e2e` with `*.spec.ts` means neither runner picks up the other's files.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a retried login spec would double-spend the shared rate-limit
  // budget and can mask real flakiness in auth/session handling.
  retries: 0,
  // One worker locally keeps the shared login bucket and the single SQLite
  // writer calm; CI can afford the same for determinism.
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Signs in once through the UI and persists the session (localStorage token)
    // to disk for the authenticated project to reuse.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    // Journeys that must start signed-out: redirects, the login form itself,
    // invalid credentials, and a tampered-token check. No stored session.
    {
      name: "guest",
      testMatch: /.*\.guest\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: { cookies: [], origins: [] } },
    },

    // Dashboard journeys as a CS user (cannot export), reusing the token
    // captured by `setup` so they cost zero login attempts.
    {
      name: "cs",
      testMatch: /.*\.cs\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/cs.json",
      },
    },

    // Dashboard journeys as an Operation user (may export).
    {
      name: "operation",
      testMatch: /.*\.operation\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/operation.json",
      },
    },
  ],

  webServer: [
    {
      // `rm -f` guarantees a fresh seed; WAL sidecar files go too.
      command: `rm -f "${e2eDbPath}" "${e2eDbPath}-wal" "${e2eDbPath}-shm" && CGO_ENABLED=1 go run main.go`,
      cwd: backendDir,
      env: backendEnv,
      url: `http://localhost:${BACKEND_PORT}/health`,
      // First cgo build of the SQLite driver is slow on a cold cache.
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      // Surface backend errors (e.g. a boot failure) without drowning the run
      // in per-request access logs.
      stderr: "pipe",
    },
    {
      command: "pnpm dev",
      env: { NEXT_PUBLIC_API_BASE_URL: `http://localhost:${BACKEND_PORT}` },
      url: BASE_URL,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
