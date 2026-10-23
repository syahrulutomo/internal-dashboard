# DurianPay Internal Dashboard (frontend)

Next.js 16 (App Router) + React 19 + TanStack Query + Tailwind v4 dashboard for
the DurianPay payments API. Staff log in, view a payments summary, and browse,
search, filter, and (for the `operation` role) export payments.

## Getting Started

Prerequisites: Node 20+, `pnpm` (the `packageManager` is pinned), and the Go API
running on `:8080` (see `../backend`). The client reads
`NEXT_PUBLIC_API_BASE_URL`, which defaults to `http://localhost:8080`
(`libs/env.ts`).

```bash
pnpm install
pnpm dev      # Turbopack dev server on http://localhost:3000
pnpm build    # production build (also type-checks the whole project)
pnpm start    # serve the production build
pnpm lint     # eslint (flat config)
```

### Architecture

- `app/` — App Router routes (`/`, `/login`, `/dashboard`); pages are thin and render a container.
- `views/container/` — smart components (data fetching, auth, state).
- `views/presentation/` — dumb components (props in, UI out).
- `views/ui/` — generic primitives (Button, Card, Input, Badge, …).
- `services/` — TanStack Query layer (`auth`, `payments`, `summary`, `providers`, `query-client`).
- `libs/` — `api-client`, `auth-storage`, `permissions`, `env`, `format`, `types`.
- `hooks/` — `use-auth`, `use-auth-guard`, `use-can`, …

### Auth & RBAC (client side)

The JWT session is persisted in a cookie (`libs/auth-storage.ts`) and attached as
a bearer token by `apiFetch`. Route guards (`use-auth-guard`) redirect
unauthenticated users to `/login`; a `401` from any protected call logs out and
clears cached data.

Role-based access uses `libs/permissions.ts` (backed by `@rbac/rbac`): `operation`
holds `payments:export` / `payments:summary` / `payments:view`, `cs` holds only
`payments:view`. Components gate CTAs with `useCan(PERMISSIONS.PAYMENTS_EXPORT)`.
**This only hides UI** — the Go API is the real authorization boundary and returns
`403` to an unauthorized role (see `../backend`). Keep the two in lockstep.

## Testing

```bash
pnpm test        # Vitest unit/component tests (*.test.tsx)
pnpm test:e2e    # Playwright end-to-end tests (e2e/*.spec.ts)
pnpm test:e2e:ui # same, in Playwright's interactive UI runner
```

The Playwright suite is **self-contained**: `playwright.config.ts` boots the real
Go API and the Next.js app, so no servers need to be started by hand. The backend
is pointed at a throwaway SQLite file (`DB_PATH=backend/e2e.db`) that is deleted
and reseeded on every run, giving a deterministic 48-payment dataset. Requires Go
(with `CGO_ENABLED=1` support — the SQLite driver is cgo-based) and a one-time
`pnpm exec playwright install chromium`.

Login is rate-limited per IP (burst 5), so the suite signs in up to a few times
and reuses the saved sessions. `e2e/auth.setup.ts` logs in once per role (`cs`,
`operation`) and the role-specific projects (`dashboard.cs.spec.ts`,
`export.operation.spec.ts`) reuse those sessions. With the two guest login specs
that is **4 real login attempts per run (of 5 allowed)** — keep new tests on the
stored sessions rather than adding fresh logins. The limit is per backend
process: a fresh `pnpm test:e2e` boots its own backend and resets the bucket, but
if a dev backend is already running it is reused and two back-to-back runs can hit
429 in setup — restart the backend between consecutive local runs.

RBAC is covered end-to-end: the `cs` project asserts the Export CSV CTA is
hidden, the `operation` project drives the download, and
`export.operation.spec.ts` also calls the export API directly with each role's
token to prove the server returns 200 / 403 / 401 (UI hiding is not the security
boundary).

## Component library (Storybook)

```bash
pnpm storybook        # dev server on :6006
pnpm build-storybook  # static build into storybook-static/
```

Every component in `views/ui/` and `views/presentation/` has a `*.stories.tsx`
co-located next to it, with an auto-generated docs page (props table + examples).
Storybook runs on `@storybook/react-vite` (not `@storybook/nextjs`): those two
layers are pure React with no `next/*` imports, which keeps Storybook decoupled
from the Next toolchain. Containers (which use `next/navigation`) are out of scope.
Tailwind v4 and the design tokens are loaded via `.storybook/preview.ts`
(`app/globals.css`); shared sample data lives in `views/_stories/fixtures.ts`.

> Note: Next.js 16 (App Router) has breaking changes vs. older versions — see
> `AGENTS.md` before writing Next.js code.
