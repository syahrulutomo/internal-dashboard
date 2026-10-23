This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
