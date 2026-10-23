# DurianPay Internal API (backend)

Go payments API for the DurianPay internal dashboard. Clean-architecture modules
(`entity` → `repository` → `usecase` → `handler`) wired in `main.go`, with the
HTTP surface driven **OpenAPI-first** from the repo-root `../openapi.yaml`.

> `CGO_ENABLED=1` is required for every build/run/test — the SQLite driver
> (`mattn/go-sqlite3`) is cgo-based. The `Makefile` targets already set it.

## Quick start

```bash
cp env.sample .env      # first-time setup
make tool-openapi       # install oapi-codegen v2 (one-time)
make openapi-gen        # regenerate internal/openapigen from ../openapi.yaml
make dep                # go mod tidy && go mod vendor
make gen-secret         # print a JWT_SECRET to paste into .env
make run                # serves on :8080
```

| Target | What it does |
|---|---|
| `make run` | `CGO_ENABLED=1 go run main.go` — serves on `:8080` |
| `make build` | binary into `./bin/mygolangapp` |
| `make test` | `CGO_ENABLED=1 go test ./...` |
| `make openapi-gen` | regenerate `internal/openapigen/openapi.gen.go` from the spec |
| `make dep` | `go mod tidy && go mod vendor` |
| `make gen-secret` | print a strong `JWT_SECRET` |

## OpenAPI-first

`../openapi.yaml` is the single source of truth for routing, request validation,
and authentication. To change the API surface: edit the spec → `make openapi-gen`
→ implement the new method on `*api.APIHandler` (`internal/api/api_handler.go`),
which must satisfy the generated `openapigen.ServerInterface` and delegates to the
relevant module handler. In `internal/service/http/server.go`, `HandlerFromMux`
wires the generated routes and `OapiRequestValidatorWithOptions` validates every
request against the spec. Routes not in the spec (`/openapi.yaml`, `/docs`,
`/ready`) are registered outside the validated group.

## Endpoints

| Method & path | Auth | Notes |
|---|---|---|
| `GET /health` | public | Liveness probe |
| `POST /dashboard/v1/auth/login` | public | `{email, password}` → `{email, role, token}` (JWT); rate-limited per IP |
| `GET /dashboard/v1/auth/me` | bearer | Caller identity `{email, role}` from the token — never echoes the token |
| `GET /dashboard/v1/payments` | bearer | List; `status`, `search`, `sort`, `page`, `per_page` |
| `GET /dashboard/v1/payments/summary` | bearer | Aggregate counts + volume across all payments |
| `GET /dashboard/v1/payments/export` | bearer, **`operation` only** | Full matching set for reconciliation; a `cs` caller gets `403` |

Also wired directly (outside the spec): `GET /ready` (readiness probe backed by
`db.PingContext`), `GET /openapi.yaml`, and `GET /docs` (Swagger UI against the
running server).

## Auth & RBAC

- **Authentication** is enforced at the validator layer: `middleware.NewJWTAuthenticator`
  is the `bearerAuth` `AuthenticationFunc`, so only endpoints that declare
  `security: [bearerAuth]` in the spec are protected (login stays public).
- **Authorization** is a separate layer. `middleware.WithClaims` re-parses the
  verified token and puts the caller's `role` on the request context
  (`ClaimsFromContext`); the role *policy* lives in the usecase — e.g.
  `PaymentUsecase.ExportPayments` returns `entity.ErrorForbidden` (→ `403`) for any
  role other than `operation`, failing closed when claims are absent.
- Domain errors use `entity.AppError` with a `Code`
  (`internal_error` / `not_found` / `unauthorized` / `forbidden` / `bad_request`);
  `transport.WriteError` maps the code to the HTTP status and emits
  spec-shaped `{code, message}` JSON.

## Database & seeding

SQLite file at `DB_PATH` (default `dashboard.db`, gitignored). `main.go` creates
the tables and **seeds on first run**: users `cs@test.com` (role `cs`) and
`operation@test.com` (role `operation`), both password `password`, plus 48
deterministic payments. Delete the `.db` file to reseed. `DB_PATH` is
env-configurable (the Playwright e2e suite points it at a throwaway `e2e.db`).

## Testing

```bash
make test                                             # all packages
CGO_ENABLED=1 go test ./internal/module/payment/...   # a subset
CGO_ENABLED=1 go test -coverprofile=cover.out ./...   # with coverage
```

Usecase and middleware logic is unit-tested against hand-written fakes (no DB or
cgo needed); repository and transport layers are tested against real SQLite /
`httptest`. `internal/service/http/server_integration_test.go` assembles the
production component graph and drives it end-to-end — covering routing,
validation, auth, RBAC (export `200`/`403`/`401`), and DTO shapes.
