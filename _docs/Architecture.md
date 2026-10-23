# Architecture — DurianPay Internal Dashboard

Technical companion to [`PRD.md`](./PRD.md). This document explains how the system is
structured, the conventions that hold it together, and the reasoning behind the key
decisions.

## 1. System Overview

```
┌──────────────────────────┐        HTTPS / JSON         ┌──────────────────────────┐
│  Frontend (Next.js 16)   │  ───────────────────────▶   │   Backend (Go 1.25)      │
│  App Router · React 19   │   Bearer JWT on protected    │   chi router + OpenAPI   │
│  TanStack Query · TW4    │   calls                      │   validator middleware   │
│                          │  ◀───────────────────────   │                          │
│  cookie: token+role      │   { code, message } errors   │   SQLite (dashboard.db)  │
└──────────────────────────┘                             └──────────────────────────┘
                     ▲                                               ▲
                     └──────── openapi.yaml (single source) ─────────┘
                        drives backend routing/validation &
                        the frontend's shared request/response shapes
```

- **Contract-first:** `openapi.yaml` at the repo root is the single source of truth. The
  backend generates its router/types/validator from it; the frontend mirrors the same
  shapes in `libs/types.ts`.
- **Stateless auth:** JWT is issued at login and sent as a bearer token; the server holds
  no session state, which keeps the API horizontally scalable.
- **Read-only dashboard:** the only mutating endpoint is login; everything else reads
  payments.

## 2. Repository Layout

```
fullstack-boilerplate/
├── openapi.yaml            # API contract — source of truth for both sides
├── README.md               # root setup/run/test instructions
├── _docs/                  # PRD.md, Architecture.md
├── backend/                # Go payments API
└── frontend/               # Next.js dashboard
```

## 3. Backend Architecture

### 3.1 Tech stack
Go 1.25.5 · `chi` router · `oapi-codegen` v2 (codegen + request validator) ·
`golang-jwt/jwt/v5` · `golang.org/x/crypto/bcrypt` · `mattn/go-sqlite3` (cgo).

### 3.2 OpenAPI-first request pipeline
Routes are **never** hand-registered. The flow to change the API surface is:

1. Edit `openapi.yaml`.
2. `make openapi-gen` → regenerates `internal/openapigen/openapi.gen.go` (DTO types, the
   `ServerInterface`, and the embedded spec).
3. Implement the method on `*api.APIHandler`, which must satisfy the generated
   `ServerInterface`, delegating to the relevant module handler.

In `internal/service/http/server.go`:
- `HandlerFromMux` wires the generated routes.
- `OapiRequestValidatorWithOptions` validates **every** request (body, params, auth)
  against the spec before it reaches a handler.
- Non-spec routes (`/openapi.yaml`, `/docs` Swagger UI) are registered **outside** the
  validated group, otherwise the validator would reject them. `GET /docs` serves Swagger
  UI against the running server.

### 3.3 Clean-architecture modules
Each feature lives under `internal/module/<name>/` and is split into layers, wired
top-down in `main.go` (`handler ← usecase ← repository`). Each layer depends only on the
**interface** of the layer below, which is what makes the usecases unit-testable with
hand-written fakes.

```
internal/
├── entity/                     # shared domain types + error model (NOT per-module)
│   ├── payment.go  user.go  error.go
├── module/
│   ├── auth/      handler/ usecase/ repository/   # full stack
│   ├── payment/   handler/ usecase/ repository/   # full stack
│   └── health/    handler/                        # handler-only (stateless probe)
├── api/api_handler.go          # aggregates module handlers → ServerInterface
├── middleware/                 # cors.go, auth.go (JWT authenticator)
├── transport/jsonerror.go      # AppError → HTTP status + {code,message} JSON
├── service/http/server.go      # router assembly, validator, middleware order
├── config/env.go               # env parsing + defaults
└── openapigen/openapi.gen.go   # generated — do not edit by hand
```

Not every module needs four layers: `health` is handler-only; `auth` and `payment` are
full stacks.

### 3.4 Payments: filtering, pagination, sorting, summary
- The handler maps query params (`status`, `search`, `id`, `sort`, `page`, `per_page`)
  into an `entity.PaymentFilter`.
- The **usecase** validates `status` against `PaymentStatus.IsValid()` (unknown →
  `400`), then normalises pagination (`page ≥ 1`, `1 ≤ per_page ≤ 100`, defaults 1/20),
  calls `repo.Count(ctx, filter)` + `repo.List(ctx, filter)`, and computes `TotalPages`
  via ceiling division — returning an `entity.PaymentPage`.
- The **repository** translates the filter into parameterised SQL (`WHERE` on status /
  partial id+merchant search, `ORDER BY` from the sort spec, `LIMIT/OFFSET` for the page).
- **Summary is computed server-side**, not in the browser. `GET /payments/summary` runs a
  single `GROUP BY status` aggregation (`repo.Summary(ctx)`) returning per-status counts
  and summed volume. The frontend consumes this directly instead of fetching every row and
  reducing client-side, so the summary is correct and cheap regardless of dataset size.
- **Context propagation:** every repository method takes `context.Context` and uses
  `QueryContext`/`QueryRowContext`, so a cancelled or timed-out HTTP request stops the
  in-flight DB work rather than leaking it.
- **Money is stored as `amount_cents` (INTEGER)** so numeric sorting is correct
  (lexicographic TEXT sorting would order `"9"` after `"100"`), and serialised back to a
  decimal string at the transport layer to match the contract.
- Indexes exist on `payments(status)` and `payments(created_at)` — the fields filtered and
  sorted on.

### 3.5 Authentication & authorization
- **JWT auth is enforced at the validator layer, not in handlers.**
  `middleware.NewJWTAuthenticator` is plugged into the OpenAPI validator as the
  `bearerAuth` `AuthenticationFunc`. Only endpoints that declare `security: [bearerAuth]`
  in the spec are protected; login is public purely because its spec entry has no
  `security`. This keeps authz declarative and co-located with the contract.
- Login: `auth` usecase looks up the user, compares the bcrypt hash, and (on success)
  signs an HS256 JWT with `sub`/`email`/`role`/`iat`/`exp` — the role is signed into the
  token so downstream authorization needs no second DB lookup and the client can't tamper
  with it. An unknown user is mapped to the same `401 invalid credentials` as a bad
  password to avoid user enumeration; genuine internal errors still surface as `500`.
- The authenticator pins the accepted algorithm to HS256 (`jwt.WithValidMethods`) and
  requires an expiry (`jwt.WithExpirationRequired`), closing the `alg:none` /
  algorithm-confusion class of attacks.
- Login is **rate-limited** per client IP (token bucket, `middleware.RateLimiter`) to
  blunt credential brute-forcing; over-limit requests get a spec-shaped `429`. The limiter
  is in-process (one bucket store per replica) — a shared Redis store is the multi-replica
  upgrade, which is why it's isolated behind the `RateLimiter` type.

### 3.6 Error model
- Domain errors are `entity.AppError{ Code, Message }` with codes
  `internal_error` / `not_found` / `unauthorized` / `bad_request`.
- Handlers return these from usecases (e.g. `entity.ErrorBadRequest(...)`) rather than
  writing status codes directly; `transport.WriteError` maps the code → HTTP status and
  emits the spec-shaped `{ code, message }` body.
- Validator/auth failures are rendered by `jsonErrorHandler` in `server.go` in the **same**
  shape, so clients only ever parse one error format.

### 3.7 Middleware ordering (load-bearing)
The chain, outermost first: **RequestID → AccessLog → CORS → (per-group) login
rate-limit → OpenAPI validator (+ JWT auth) → handler**.
- `RequestID` assigns/propagates an `X-Request-ID` correlation id on the context and
  response.
- `AccessLog` emits one structured `slog` line per request (method, path, status, bytes,
  duration, request id) — never logging secrets or PII.
- `CORS` is registered **before** the OpenAPI validator because the validator has no
  `OPTIONS` route, so CORS must short-circuit preflight `OPTIONS` with a `204` before
  validation can reject it. The allow-list comes from `CORS_ALLOWED_ORIGINS`.

### 3.8 Observability & operations
- **Structured logging:** `slog` — text handler in development, JSON in production (set by
  `APP_ENV`) for log aggregation. Every access log carries the request id so a request can
  be traced across lines.
- **Probes:** `/healthz` (liveness, no dependencies) and `/readyz` (readiness — pings the
  DB with a 2s timeout and returns `503` until it answers), so an orchestrator only routes
  traffic once the instance can serve.
- **Graceful shutdown:** `signal.NotifyContext`-style SIGINT/SIGTERM handling drains
  in-flight requests via `server.Shutdown` with a 10s deadline before closing.
- **Fail-fast config:** `config.Validate()` runs at boot and, in production, refuses to
  start on a missing/default/short `JWT_SECRET` or a wildcard CORS origin — a
  misconfiguration is a loud crash, not a silent insecure serve.

### 3.9 Persistence & seeding
- SQLite file `backend/dashboard.db` (gitignored). `CGO_ENABLED=1` is required everywhere
  because the SQLite driver is cgo-based. The DSN sets `_busy_timeout=5000` and
  `_journal_mode=WAL` so concurrent readers/writers wait briefly for the lock instead of
  failing immediately with "database is locked".
- `main.go` creates tables and **seeds on first run**: two users (`cs@test.com`,
  `operation@test.com`, password `password`) and 48 deterministic payments with a weighted
  status distribution. Delete the DB file to reseed. (The `mysql` driver is imported but
  SQLite is what runs.)
- **Scaling note:** SQLite is a single-file embedded DB — fine for this review and
  single-instance deployment. For true multi-instance horizontal scaling it would be
  swapped for a networked Postgres/MySQL (and the in-process rate-limiter for Redis); the
  repository interface isolates the DB change to one layer.

### 3.10 Commands (from `backend/`)
```bash
cp env.sample .env      # first-time setup
make tool-openapi       # install oapi-codegen v2 (one-time)
make openapi-gen        # regenerate internal/openapigen/openapi.gen.go
make gen-secret         # print a JWT_SECRET for .env
make run                # CGO_ENABLED=1 go run main.go  — serves on :8080
make build              # binary into ./bin/mygolangapp
make test               # CGO_ENABLED=1 go test ./...
```

## 4. Frontend Architecture

### 4.1 Tech stack
Next.js 16.4.2 (App Router, Turbopack) · React 19.3 · TanStack Query v5 · Tailwind CSS v4
· TypeScript 5 · pnpm (pinned via `packageManager`). No test runner is configured by
default.

### 4.2 Container / Presentation split
```
frontend/
├── app/                        # App Router routes — thin pages that render a container
│   ├── page.tsx  login/  dashboard/  layout.tsx
├── views/
│   ├── container/              # SMART: data fetching, hooks, auth, state
│   │   ├── DashboardContainer/  LoginContainer/
│   ├── presentation/           # DUMB: props in, UI out, no fetching
│   │   ├── DashboardShell  PaymentsHero  StatCards  RecentPayments
│   │   ├── PaymentsHeader  StatusBadge  ErrorBanner  LoginForm  LoginHero ...
│   └── ui/                      # generic primitives: Button, Card, Input, Badge, Spinner...
├── services/                   # TanStack Query layer
│   ├── payments/  auth/  query-client/  providers/
├── libs/                        # api-client, auth-storage, env, format, types, cn
└── hooks/                       # use-auth (context), use-auth-guard, use-debounced-value
```
Import alias: `@/*` → the frontend root.

### 4.3 State management
Two kinds of state, cleanly separated:

- **Server state → TanStack Query.** All API data goes through a `queryOptions` contract in
  `services/` (never `apiFetch` directly from components). `paymentsQuery.options(filter)`
  puts the filter in the query key, so each status/page/search combination is cached
  independently and changing a filter triggers a refetch. `keepPreviousData` keeps the
  current rows on screen while the next page loads (no skeleton flash). `useLogin` is a
  mutation.
- **Session state → external store + React context** (`libs/auth-storage.ts`,
  `hooks/use-auth.tsx`). The JWT + role live in a non-HttpOnly `internal_token` cookie
  (`SameSite=Lax`, `path=/`, 7-day max-age), exposed as a tiny subscribable store the context
  reads via `useSyncExternalStore` — SSR-safe, with no `setState`-in-effect hydration.
  `hydrated` is itself a snapshot (`false` on the server, `true` after mount) so guards
  don't flash.
- **UI/filter state → local `useState`** in `DashboardContainer` (`status`, `search`,
  `page`). Changing status or search resets `page` to 1, because a stale page number can
  fall out of range for a narrower result set.

The `DashboardContainer` runs **two** queries on load: a summary query (the server-side
`/payments/summary` aggregate — the single source for the hero, stat cards, and tab
counts) and a table query (status + search + page round-tripped to the server). CSV export
fetches its rows **on demand** when the user clicks Export (`queryClient.fetchQuery` for the
active status at `per_page=100`), so the dashboard never eagerly pulls the full list just
to show the summary.

### 4.4 Auth flow (fully client-side)
- `libs/api-client.ts` (`apiFetch`) attaches the bearer token by default; `auth: false`
  opts out (used by login). It throws a typed `ApiError` carrying the HTTP status.
- `useAuthGuard("protected" | "guest")` handles redirects and waits for `hydrated` to
  avoid flashes.
- On any `401` from a protected call, the container calls `logout()`, which clears the
  stored session and `queryClient.clear()`s the cache so a new user can't see stale data.
- There is **no** server-side/middleware route protection — guarding is client-side, which
  is acceptable because the API independently enforces auth on every protected call. A
  route-segment error boundary (`app/error.tsx`) catches unexpected render errors.
- **Token storage trade-off:** the JWT lives in a non-HttpOnly `SameSite=Lax` cookie for a
  fully client-side SPA, which is still XSS-readable (the client reads it to attach the bearer
  token). React's escaping and no `dangerouslySetInnerHTML` mitigate this; the hardened
  alternative (an **HttpOnly** cookie set by the server) is the production upgrade if/when the
  backend owns the session.

### 4.5 OpenAPI integration
The frontend consumes the same contract: request/response shapes in `libs/types.ts`
mirror the OpenAPI schemas (`Payment`, `PaymentListResponse`, `PaginationMeta`, `User`),
and the services call the exact paths/params the spec defines. The backend validates every
request against that spec, so contract drift surfaces immediately as a validation error.

### 4.6 Localisation detail
The product is Indonesian: amounts render as Rupiah (`Rp 1.250.000`) and timestamps in WIB
(`Asia/Jakarta`, UTC+7) via `libs/format.ts`. The service layer maps the API's snake_case,
decimal-string summary wire shape into the UI-facing `PaymentsSummary` (number amounts) so
presentation components need no changes.

### 4.7 Next.js 16 note
This repo runs App Router with Next 16 breaking changes. `frontend/AGENTS.md`
(auto-regenerated by `next dev`) instructs reading `node_modules/next/dist/docs/` before
writing Next code; typed route props (e.g. `LayoutProps<"/">`) are already in use.

### 4.8 Commands (from `frontend/`)
```bash
pnpm install
pnpm dev      # next dev (Turbopack) on :3000
pnpm build
pnpm start
pnpm lint     # eslint (flat config)
pnpm test     # vitest (component + unit tests)
```
`NEXT_PUBLIC_API_BASE_URL` points the client at the backend (default
`http://localhost:8080`, in `libs/env.ts`).

## 5. API Surface (from `openapi.yaml`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /healthz` | public | Liveness probe (`{ status, time }`) |
| `GET /readyz` | public | Readiness probe — pings the DB; `503` until ready (ops route, not in the spec) |
| `POST /dashboard/v1/auth/login` | public | Email/password → `{ email, role, token }`; rate-limited per client IP |
| `GET /dashboard/v1/payments` | `bearerAuth` | List payments; query: `status`, `search`, `id`, `sort`, `page`, `per_page`; returns `{ payments[], meta }` |
| `GET /dashboard/v1/payments/summary` | `bearerAuth` | Aggregate counts + volume across all payments (`{ total, completed, processing, failed, total_amount, amount_by_status }`) |

Error responses everywhere use `{ code, message }` (`400/401/404/429/500`). `GET /docs`
serves Swagger UI.

## 6. Testing Strategy

The strategy is to test each layer at the level where its logic lives, with fakes at the
seams so tests stay fast and deterministic.

- **Backend (`make test`, Go `testing`):** usecases are unit-tested against hand-written
  fake repositories and pure helpers directly
  (`internal/module/{auth,payment}/.../*_test.go`), needing neither a DB nor cgo —
  covering login (success, wrong password, unknown-user → 401), payment validation /
  pagination defaults & clamping / summary delegation. Repository tests exercise the SQL
  builders (ORDER BY allow-list, WHERE/LIKE escaping with explicit SQL-injection cases)
  and require `CGO_ENABLED=1`. Middleware tests (`httptest`) cover the login rate limiter
  (burst, per-IP isolation, path scoping). Single run:
  `CGO_ENABLED=1 go test ./internal/module/payment/usecase/ -run TestListPayments`.
- **Frontend (`pnpm test`, Vitest + React Testing Library on jsdom):** the
  container/presentation split is the testing boundary. Pure logic — the `format`
  helpers and summary math — is unit-tested; presentation components are tested by
  user-facing behaviour: `LoginForm` (validation, email trimming, password toggle,
  server-error display) and `StatusBadge`. Tests assert behaviour, not implementation,
  and use no real network.

## 7. Key Design Decisions (rationale summary)

| Decision | Why |
|---|---|
| OpenAPI-first with a validator middleware | One contract drives routing, validation, auth declaration, and the FE types — no drift, no hand-written routes. |
| Auth enforced at the validator, not in handlers | Authz stays declarative and co-located with the spec; handlers stay pure. |
| `amount_cents` integer storage | Correct numeric sorting and no float rounding for money. |
| Stateless JWT | Horizontally scalable API with no session store. |
| Server-side filter/search/pagination | Bounds payload size and scales past the in-memory/48-row dataset; matches the contract. |
| Clean-architecture modules with interfaces per layer | Unit-testable usecases with fakes; swappable persistence (SQLite → Postgres) isolated to the repo layer. |
| Container/Presentation + TanStack Query | Clear separation of data/state from UI; cached, deduped, filter-keyed server state with no skeleton flash. |
| Client-side guard + API-enforced auth | Simple UX guard, with the real security boundary on the server. |
| `context.Context` threaded to the DB | Request cancellation/timeouts stop in-flight DB work instead of leaking it. |
| Server-side summary aggregate endpoint | Correct, O(1)-payload summary via one `GROUP BY` — no shipping every row to the client to reduce. |
| slog + request id + `/readyz` | Operable under real traffic: traceable logs and readiness-gated routing. |
| Login rate-limit + fail-fast config + HS256-pinned, expiry-required JWT | Blunts brute-force, refuses insecure prod boot, and closes `alg`-confusion attacks. |
| `useSyncExternalStore` for the auth store | SSR-safe session hydration with no setState-in-effect, plus cross-tab logout sync. |
