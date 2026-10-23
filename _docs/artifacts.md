# Review & Remediation Log — DurianPay Internal Dashboard

This document records the issues and gaps found when auditing the project against the PRD
and a production-readiness bar (the `principal-backend` / `principal-web` standards), and
the fix applied to each. It is the "artifacts" of the review: what was wrong, why it
mattered, and what changed.

**Status after remediation:** backend `go build` / `go vet` / `go test` all green;
frontend `tsc` / `eslint` / `vitest` all green; `pnpm build` (Next.js production build)
succeeds.

Legend: 🔴 submission blocker · 🟠 production gap · 🟡 quality/robustness.

---

## A. Submission blockers (would fail review as-is)

### A1. 🔴 Frontend did not compile — leftover prop from a half-finished refactor
- **Symptom:** `tsc --noEmit` failed (`TS2322`) and therefore `pnpm build` failed.
  `DashboardContainer` passed a `roleLabel` prop that `PaymentsHeader` no longer accepts
  (a summary-endpoint refactor had been left mid-flight).
- **Why it matters:** the grading rules auto-reject a submission that doesn't build/run.
- **Fix:** removed the dead `roleLabel` computation and prop.
  `views/container/DashboardContainer/index.tsx`.
- **Verified:** `pnpm exec tsc --noEmit` clean; `pnpm build` succeeds (4 static routes).

### A2. 🔴 Root `README.md` was an empty boilerplate skeleton
- **Symptom:** placeholder "Add here" text, and it wrongly described the frontend as "nuxt".
- **Why it matters:** the assignment makes a complete root README (prerequisites, setup,
  **seed**, build/start/test, API docs) a hard pass/fail gate.
- **Fix:** rewrote `README.md` — prerequisites table, two-terminal quick start, full
  config tables (backend `.env` + frontend), seed-data section, production build/run, how
  to run both test suites, and API-docs pointers (`/docs`, `/openapi.yaml`, probes).

### A3. 🔴 No frontend tests, and no test runner configured
- **Symptom:** backend had table-driven tests; frontend had none, despite the assignment
  explicitly asking for frontend unit tests + a testing-strategy write-up.
- **Fix:** added **Vitest + React Testing Library** (jsdom):
  - `vitest.config.ts`, `vitest.setup.ts`, `test` / `test:watch` scripts.
  - `libs/format.test.ts` — currency, WIB date/time, `summarize`, `statusPercent` (8 tests).
  - `views/presentation/LoginForm/LoginForm.test.tsx` — validation, trimming, password
    toggle, server-error display (5 tests).
  - `views/presentation/StatusBadge/StatusBadge.test.tsx` — status labels (1 test).
  - pinned `pnpm.onlyBuiltDependencies: ["esbuild"]` so a clean reviewer install can build
    the test toolchain.
- **Verified:** `pnpm test` → 3 files, 14 tests passing. Strategy documented in
  `README.md` §6 and `Architecture.md` §6.

### A4. 🔴 Design docs drifted from the code
- **Symptom:** `PRD.md` / `Architecture.md` described the summary as a client-side
  `summarize()` over the full list, but the code had moved to a dedicated server-side
  `GET /dashboard/v1/payments/summary` endpoint + `useSummary`.
- **Fix:** updated both docs — API surface table, the summary user story (FR-7), state
  management (three queries, not two), localisation note, testing strategy, and the
  key-decisions table.

---

## B. Backend production gaps (principal-backend bar)

### B1. 🟠 No `context.Context` propagation to the database
- **Gap:** repositories used `Query`/`QueryRow` with no context; interfaces didn't take
  one. A client disconnect or slow query couldn't be cancelled, and there was no per-call
  deadline — the biggest backend gap.
- **Fix:** threaded `context.Context` as the first parameter through every layer and
  switched to `QueryContext`/`QueryRowContext`.
  - `entity`-facing interfaces + impls: `module/payment/repository/payment.go`,
    `module/auth/repository/user.go`.
  - usecases: `module/payment/usecase/payment.go`, `module/auth/usecase/auth.go`.
  - handlers now pass `r.Context()`: `module/{payment,auth}/handler/*.go`.
  - test fakes updated to the new signatures.

### B2. 🟠 No observability — no access logs, request ids, or readiness check
- **Gap:** only `log.Printf` at startup; `/healthz` was static (didn't prove the service
  could actually serve).
- **Fix:**
  - `middleware/requestid.go` — assigns/propagates an `X-Request-ID` correlation id.
  - `middleware/logger.go` — one structured `slog` access-log line per request
    (method, path, status, bytes, duration, request id); never logs secrets/PII.
  - `main.go` — `slog` configured (text in dev, JSON in prod via `APP_ENV`).
  - `/readyz` ops route in `service/http/server.go` pings the DB (2s timeout) and returns
    `503` until ready; lifecycle logs switched to `slog`.

### B3. 🟠 Login endpoint had no rate limiting (brute-force exposure)
- **Fix:** `middleware/ratelimit.go` — in-process token-bucket limiter keyed by client IP
  (honours a single `X-Forwarded-For` hop), applied via `LimitPath` only to
  `POST /dashboard/v1/auth/login`; over-limit → spec-shaped `429` with `Retry-After`.
  Documented as single-replica (Redis is the multi-replica upgrade).
- **Tests:** `middleware/ratelimit_test.go` — burst cutoff, per-IP isolation, path scoping.

### B4. 🟠 Insecure default JWT secret could boot silently in production
- **Gap:** `JWT_SECRET` fell back to `"dev-secret-replace-me"`; an unset secret in prod
  would serve with a known key.
- **Fix:** `config.Validate()` (+ `APP_ENV` / `IsProduction()`) called at boot in
  `main.go` — in production it refuses to start on a missing/default/short (`< 32 byte`)
  secret or a wildcard CORS origin. Fail loud, not silently insecure. `env.sample` and the
  README document the new vars.

### B5. 🟠 JWT validated but identity discarded; algorithm not pinned
- **Gap:** the authenticator checked signature+expiry but the token carried no role, and
  it accepted any signing method the key-func allowed.
- **Fix:**
  - `module/auth/usecase/auth.go` — sign `email` + `role` into the claims (signed, so the
    client can't tamper with its own role; no second DB lookup needed downstream).
  - `middleware/auth.go` — `jwt.WithValidMethods([HS256])` + `jwt.WithExpirationRequired()`,
    closing the `alg:none` / algorithm-confusion class of attacks.

### B6. 🟡 SQLite concurrency robustness
- **Gap:** default SQLite can return "database is locked" under concurrent access.
- **Fix:** DSN now sets `_busy_timeout=5000` and `_journal_mode=WAL` in `main.go` so
  concurrent readers/writers wait briefly for the lock.

> **Acknowledged, not "fixed" (by design):** SQLite is single-file and the rate-limiter is
> in-process, so neither scales across replicas. Both are isolated behind interfaces/types
> so the production swap (Postgres/MySQL, Redis) touches one layer. Recorded in
> `Architecture.md` §3.9 as a deliberate scope boundary.

---

## C. Frontend robustness & quality (principal-web bar)

### C1. 🟠 No error boundary
- **Fix:** added `app/error.tsx` — a route-segment error boundary with a recovery action,
  so an unexpected render error isolates to the segment instead of blanking the app.

### C2. 🟡 Login form had no client-side validation
- **Gap:** `noValidate` with no replacement — an empty/garbage submit still round-tripped.
- **Fix:** inline, accessible validation in `LoginForm` (required + email shape), shown
  only after a submit attempt; `Input` now wires `aria-describedby` to the error message.
  Covered by the new `LoginForm` tests.

### C3. 🟡 `set-state-in-effect` lint error in the auth provider
- **Gap:** `useEffect(() => setUser(loadAuth()))` hydration pattern tripped
  `react-hooks/set-state-in-effect`, failing `pnpm lint`.
- **Fix (principled, not suppressed):** converted `libs/auth-storage.ts` into a small
  subscribable external store and read it in `hooks/use-auth.tsx` via
  `useSyncExternalStore` (with a server snapshot of `null`). This removes the effect
  entirely, is SSR-safe, and adds **cross-tab logout sync** via a `storage` listener as a
  bonus. `hydrated` is now itself a snapshot (`false` on server, `true` after mount).

### C4. 🟡 Unused import
- **Fix:** removed an unused `ChevronDownIcon` import in `Topbar` (the other half of the
  lint failure).

### C5. 🟡 Token storage trade-off made explicit
- The JWT in `localStorage` is XSS-readable. Not changed (it's inherent to the fully
  client-side SPA design), but the trade-off and the httpOnly-cookie upgrade path are now
  documented in `Architecture.md` §4.4 rather than left implicit.

---

## D. PRD fulfilment (after fixes)

All functional requirements are implemented and now build/run and test green.

| FR | Requirement | Status |
| --- | --- | --- |
| FR-1 | Login → JWT + role | ✅ (HS256-pinned, expiry required, role in claims, rate-limited, no user enumeration) |
| FR-2 | Protected payments list | ✅ |
| FR-3 | Server-side status filter (invalid → 400) | ✅ |
| FR-4 | Login page → store token/role → redirect | ✅ |
| FR-5 | Protected route guard (+ error boundary) | ✅ |
| FR-6 | Table (ID, Merchant, Date, Amount, Status) | ✅ |
| FR-7 | Summary widget (server-side aggregate endpoint) | ✅ |
| FR-8 | Server-side search (debounced, LIKE-escaped) | ✅ |
| FR-9 | Pagination with metadata | ✅ |
| FR-10 | CSV export + manual refresh | ✅ |

---

## E. Containerisation (Docker Compose)

Added a one-command full-stack run with automatic migration + seed and persistent data.

- **`docker-compose.yml`** (repo root) — `backend` (:8080) + `frontend` (:3000) with a
  `db-data` named volume; the frontend `depends_on` the backend's `/readyz` healthcheck so
  it only starts once the DB is migrated/seeded and reachable.
- **`backend/Dockerfile`** — multi-stage, cgo SQLite build (`golang:1.25-bookworm` →
  `debian:bookworm-slim`), runs as a non-root user; build context is the repo root so the
  image includes `openapi.yaml`. Schema migration + demo seed run automatically on first
  boot (idempotent `initDB`/`seedPayments`).
- **`frontend/Dockerfile`** — pnpm via corepack, Next.js **standalone** output
  (`next.config.ts: output: "standalone"`), non-root runtime. `NEXT_PUBLIC_API_BASE_URL`
  is a build arg (defaults to the host-published `http://localhost:8080`, because API
  calls are client-side).
- **`DB_PATH` config var** (new) — makes the SQLite file location configurable so compose
  can point it at the mounted volume (`/app/data/dashboard.db`) for persistence across
  restarts. `backend/internal/config/env.go`, `backend/main.go`, `env.sample`.
- **`.dockerignore`** (root + `frontend/`) — keeps build contexts lean and excludes local
  secrets/DB files.
- **Build-script approval fix** — the clean Docker `pnpm install` failed with
  `ERR_PNPM_IGNORED_BUILDS` for `esbuild` and `unrs-resolver`. The pinned pnpm (v12) no
  longer reads the `pnpm` field in `package.json`; the approvals live in
  `frontend/pnpm-workspace.yaml` under `allowBuilds:` (committed, and copied in the
  Dockerfile deps stage), so `pnpm install --frozen-lockfile` runs those builds instead of
  aborting.
- **Verified:** `docker compose config` parses; Next.js standalone build emits
  `.next/standalone/server.js`; backend cgo build succeeds. (A live `docker compose up`
  wasn't run here because the Docker daemon isn't available in this environment.)

## F. Login UX — 429 cooldown + error toasts

Follow-up requested after wiring the backend rate limiter.

- **5-minute login cooldown on HTTP 429.** When the login API returns `429`, the client
  starts a 5-minute lockout: the form inputs and submit button disable and the button
  shows a live `Try again in m:ss` countdown. The deadline is persisted in `localStorage`
  (`libs/login-cooldown.ts`) so a page refresh can't bypass it, exposed as an external
  store read via `useSyncExternalStore` (`hooks/use-login-cooldown.ts`) — SSR-safe, with
  cross-tab sync. The container also blocks submit while cooling down.
- **API errors (4xx/5xx) now surface as toasts, not inline.** Added a small toast system
  (`hooks/use-toast.tsx` provider + `views/presentation/Toaster` live region, wired in
  `services/providers`). Login failures and a 429 raise error toasts; the dashboard's
  payment-load failure became a toast with a **Retry** action (replacing the inline
  `ErrorBanner`). 401s remain special-cased (sign-out), not toasted. Client-side field
  validation stays inline (it isn't an API error).
- **Tests:** `LoginForm` cooldown-disabled case and a `formatCountdown` unit test added
  (15 frontend tests total).
- **Note:** the backend limiter already returns `429` with `Retry-After`; this is the
  client-side enforcement of the cooldown window. Backend behaviour was not changed.

## G. Summary endpoint is the single source for the widget (no duplicate full-list fetch)

- **Gap:** the dashboard eagerly called `GET /payments?per_page=100` on load to back CSV
  export, in addition to `GET /payments/summary` — effectively fetching the dataset twice
  for what the summary endpoint already provides.
- **Fix:** removed the eager export query. The summary widget (hero, stat cards, tab counts)
  now reads **only** from `/payments/summary`; the export button's enabled state is derived
  from the summary counts. CSV export fetches its rows **on demand** via
  `queryClient.fetchQuery` when clicked, with its own loading/empty/error (toast) handling.
  Dashboard load now makes just two calls: `/payments/summary` and the current table page.
  `views/container/DashboardContainer/index.tsx`.

## H. How to verify

```bash
# Backend
cd backend && CGO_ENABLED=1 go build ./... && CGO_ENABLED=1 go vet ./... && make test

# Frontend
cd frontend && pnpm install && pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build

# Full stack via Docker (one command)
docker compose up --build        # frontend :3000, backend :8080 (auto migrate + seed)
```

All of the non-Docker commands pass as of this remediation; the Docker build files are
syntactically valid and the standalone/cgo builds succeed (live `up` not run here — no
Docker daemon in this environment).
