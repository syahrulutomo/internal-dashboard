# Product Requirements Document — DurianPay Internal Dashboard

## 1. Overview

The **DurianPay internal dashboard** lets operations and customer-support teams monitor
incoming payments in near real time. Authenticated staff log in, see a summary of payment
volume and health, and browse, search, filter, and export a data-rich list of payments.

This PRD describes the product as implemented in this repository. It is the companion to
[`Architecture.md`](./Architecture.md), which covers the technical design.

| | |
|---|---|
| **Product** | DurianPay internal dashboard — payments monitoring |
| **Primary users** | Internal CS (`cs`) and Operations (`operation`) staff |
| **Platforms** | Responsive web app (desktop-first, works on tablet/mobile) |
| **Backend** | Go 1.25 REST API, OpenAPI-first, SQLite persistence |
| **Frontend** | Next.js 16 (App Router) + React 19 + TanStack Query + Tailwind |

## 2. Goals & Non-Goals

### Goals
- Give internal teams a single screen to **monitor incoming payments** and their health.
- Provide a **fast, filterable, paginated** view over a data-rich payment list.
- Surface an at-a-glance **summary** (total payments + success/processing/failed breakdown).
- Enforce **authenticated access**, and **role-based authorization** for role-restricted
  actions (today: payments export is limited to the `operation` role, enforced server-side).
- Be **production-shaped**: multi-user safe, validated requests, clean error handling,
  and a reproducible local setup.

### Non-Goals (current scope)
- Creating, editing, or refunding payments (read-only dashboard).
- Role-*differentiated views* — both roles see the same payments data and summary. Role-based
  authorization now gates the **export action** (`operation`-only, see §4.8), but there is no
  per-role data scoping or distinct dashboards beyond that.
- Server-side session management / token revocation (JWT is stateless).
- Payment review workflow (`PUT /payment/{id}/review` is noted in the backend README but
  intentionally **not** in scope / not in the OpenAPI spec).

## 3. Personas

| Persona | Role value | Needs |
|---|---|---|
| **CS Agent** | `cs` | Look up a specific payment by ID/merchant to answer a customer query; check whether a payment completed or failed. |
| **Operations Analyst** | `operation` | Watch overall payment health, spot spikes in `failed`/`processing`, export a slice for reconciliation. |

## 4. User Stories & Acceptance Criteria

### 4.1 Authentication
> As a staff member, I log in with my email and password so I can access the dashboard.

- **Endpoint:** `POST /dashboard/v1/auth/login` (public).
- Accepts `{ email, password }`; returns `{ email, role, token }` where `token` is a JWT.
- **Acceptance:**
  - Valid credentials → `200` with a JWT and the user's role (`cs` or `operation`).
  - Invalid email **or** password → `401 invalid credentials` (no user enumeration —
    unknown user and wrong password are indistinguishable to the client).
  - On success the frontend stores the JWT + role in client state and redirects to
    `/dashboard`.
  - Seeded test accounts: `cs@test.com` and `operation@test.com`, password `password`.

### 4.2 Protected Dashboard Route
> As a logged-in user, I reach the dashboard; as a logged-out user, I am redirected to login.

- **Acceptance:**
  - `/dashboard` is only usable with a valid session; an unauthenticated visitor is
    redirected to `/login`.
  - A logged-in user visiting `/login` is redirected to `/dashboard` (guest guard).
  - Any `401` from a protected API call signs the user out and clears cached data.

### 4.3 List Payments
> As a user, I see the list of payments with the key details.

- **Endpoint:** `GET /dashboard/v1/payments` (requires `bearerAuth`).
- **Table columns:** Payment ID, Merchant Name, Date, Amount, Status.
- **Acceptance:**
  - Returns payments plus pagination metadata (`page`, `per_page`, `total`, `total_pages`).
  - Amount is rendered as currency; date/time rendered in a human-readable, zone-aware form.
  - Status rendered as a colored badge (completed / processing / failed).

### 4.4 Filter Payments by Status
> As a user, I filter the list to one status.

- **Endpoint:** `GET /dashboard/v1/payments?status=<completed|processing|failed>`.
- **Acceptance:**
  - Valid status returns only matching payments; filtering is **server-side** (round-trips
    to the API, not filtered in the browser).
  - An **unknown** status returns `400 bad_request` rather than an empty list, so the
    client gets a clear error.
  - Changing the status resets pagination to page 1.
  - Status filter is reachable both from filter tabs and by clicking a summary stat card.

### 4.5 Summary Widget
> As a user, I see total payments and a breakdown so I can judge payment health at a glance.

- **Acceptance:**
  - Shows **Total** count and the **completed / processing / failed** breakdown
    (e.g. `Total: 48 | Completed: 29 | Processing: 12 | Failed: 7`).
  - Also surfaces total payment **volume** (sum of amounts) and per-status volume.
  - Summary reflects the **full dataset**, independent of the current table page/filter,
    and is computed **server-side** via `GET /dashboard/v1/payments/summary` (a single
    aggregation) rather than by shipping every row to the browser.

### 4.6 Search (enhancement)
> As a CS agent, I type part of a payment ID or merchant name to find a payment fast.

- **Endpoint:** `GET /dashboard/v1/payments?search=<term>`.
- **Acceptance:** Case-insensitive partial match on payment ID or merchant name,
  evaluated server-side, debounced on the client (one request per settled term, not per
  keystroke). Changing the term resets to page 1.

### 4.7 Pagination (enhancement)
> As a user, I page through a large list without loading everything at once.

- **Endpoint params:** `page` (1-based), `per_page` (1–100, default 20).
- **Acceptance:** Server returns one page plus metadata; the previous page's rows stay on
  screen while the next page loads (no skeleton flash).

### 4.8 Export & Refresh (enhancement)
> As an **operations analyst**, I export the current filtered set; as any user, I refresh on demand.

- **Endpoint:** `GET /dashboard/v1/payments/export` (`bearerAuth`, **role-restricted to
  `operation`**).
- **Acceptance:**
  - Export produces a CSV of **all** payments matching the active status filter (not just
    the visible page); merchant names with commas are safely quoted.
  - A refresh control re-fetches both the summary and the current table page, and a
    "last updated" timestamp is shown.

### 4.9 Role-based export authorization (RBAC)
> As an operations analyst I can export payments; as a CS agent I cannot.

- **Acceptance:**
  - Only the `operation` role may export. The export endpoint authorizes the caller's role
    (from the JWT) **server-side** and returns `403 forbidden` to any other role (and `401`
    when unauthenticated) — the usecase enforces this, so it holds regardless of the client.
  - The frontend hides the Export CTA for roles without the permission; this is UX only, not
    the security boundary (a tampered client still receives `403` from the server).
  - Authorization is independent of authentication: a valid session that lacks the role is
    rejected with `403`, not `401`.

## 5. Functional Requirements Summary

| # | Requirement | Status |
|---|---|---|
| FR-1 | Email/password login returning JWT + role | ✅ Implemented |
| FR-2 | Protected payments list endpoint | ✅ Implemented |
| FR-3 | Server-side status filter (completed/processing/failed) | ✅ Implemented |
| FR-4 | Login page → store token/role → redirect | ✅ Implemented |
| FR-5 | Protected dashboard route with guard | ✅ Implemented |
| FR-6 | Payments table (ID, Merchant, Date, Amount, Status) | ✅ Implemented |
| FR-7 | Summary widget (total + breakdown) | ✅ Implemented |
| FR-8 | Server-side search (id/merchant partial match) | ✅ Implemented (enhancement) |
| FR-9 | Pagination with metadata | ✅ Implemented (enhancement) |
| FR-10 | CSV export (operation role) + manual refresh | ✅ Implemented (enhancement) |
| FR-11 | Role-based authorization: export restricted to `operation`, enforced server-side (`403` for other roles, `401` unauthenticated), CTA hidden for unauthorized roles | ✅ Implemented (enhancement) |

## 6. Non-Functional Requirements

- **Production readiness / multi-user:** stateless JWT auth (HS256-pinned, expiry
  required), request validation against the OpenAPI spec, parameterised SQL (no injection),
  CORS allow-list, login rate-limiting, pagination to bound payload size, indexes on the
  filtered/sorted fields, `context` cancellation threaded to the DB, structured logging
  with request-correlation ids, liveness/readiness probes, graceful shutdown, and
  fail-fast startup on insecure production config.
- **API contract:** RESTful, defined in OpenAPI v3 (`openapi.yaml`) at the repo root and
  used as the single source of truth for routing, validation, and the frontend's types.
- **Validation:** requests validated against the OpenAPI schema at the edge; usecases add
  domain validation (e.g. rejecting unknown status). Responses are spec-shaped.
- **Error handling:** uniform `{ code, message }` error body; correct HTTP status mapping
  (`400/401/403/404/500`). The frontend handles 401 by signing out, and surfaces 403 (a role
  not permitted) as a clear "not permitted" message.
- **Testability:** backend usecases have unit tests runnable without a DB (fakes), with
  repository/middleware tests against SQLite/`httptest`; the frontend has Vitest + React
  Testing Library covering pure logic and presentation components. State is isolated in
  containers/services for clean testing boundaries.
- **DX / reproducibility:** `make` targets for the backend, `pnpm` scripts for the
  frontend, deterministic data seed on first run, and a root `README.md` with exact setup
  commands. Reviewer environment: Go 1.21+, Node 20+, macOS.
- **Linting/formatting:** `gofmt`/`go vet` on the backend, ESLint (flat config) on the
  frontend.

## 7. Data & Seeding

- **Users:** `cs@test.com` (role `cs`), `operation@test.com` (role `operation`), both with
  password `password` (bcrypt-hashed at seed time).
- **Payments:** 48 deterministic records seeded on first run — 15 merchants, weighted
  status distribution (~60% completed, ~25% processing, ~15% failed), amounts and
  timestamps spread over roughly the last 30 days — so the dashboard summary and filters
  are meaningful out of the box.
- Deleting the SQLite DB file reseeds on next start.

## 8. Out-of-Scope / Future Enhancements

- Role-differentiated **views / data scoping** (`cs` vs `operation`) — per-role authorization
  now exists for the export action (§4.9); broader role-specific dashboards and data filtering
  remain out of scope.
- Payment detail drill-down and the `review` action.
- Server-side session/token revocation and refresh tokens.
- Real-time updates (websockets / polling) and date-range filtering.
- Replacing SQLite with a networked DB (Postgres/MySQL) for true multi-instance scale.
