# syntax=docker/dockerfile:1

# ----- build stage -------------------------------------------------------
# CGO is required: the SQLite driver (mattn/go-sqlite3) compiles C, so the
# builder needs a C toolchain (bookworm ships gcc via build-essential).
FROM golang:1.25-bookworm AS build

WORKDIR /src

# Dependencies first for better layer caching. The repo vendors its modules,
# so the build is hermetic and needs no network.
COPY backend/go.mod backend/go.sum ./
COPY backend/vendor ./vendor

# Now the source and the shared API contract.
COPY backend/ ./
COPY openapi.yaml /src/openapi.yaml

RUN CGO_ENABLED=1 GOOS=linux go build -mod=vendor -o /out/server ./main.go

# ----- runtime stage -----------------------------------------------------
# Debian slim has the glibc the cgo binary links against. A non-root user runs
# the service, and /app/data is where the SQLite file (DB_PATH) lives.
FROM debian:bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates wget \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 appuser \
  && mkdir -p /app/data \
  && chown -R appuser:appuser /app

WORKDIR /app
COPY --from=build /out/server /app/server
COPY --from=build /src/openapi.yaml /app/openapi.yaml

USER appuser

# Tables are created and the demo data seeded automatically on first boot
# (main.go: initDB + seedPayments, both idempotent). With DB_PATH on a mounted
# volume, that happens once and then persists.
ENV HTTP_ADDR=:8080 \
    DB_PATH=/app/data/dashboard.db \
    OPENAPIYAML_LOCATION=/app/openapi.yaml

EXPOSE 8080
CMD ["/app/server"]
