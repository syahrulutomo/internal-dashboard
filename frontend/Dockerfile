# syntax=docker/dockerfile:1

# ----- dependencies ------------------------------------------------------
FROM node:22-bookworm-slim AS deps
RUN corepack enable
WORKDIR /app
# pnpm-workspace.yaml carries the onlyBuiltDependencies allow-list (pnpm v10+),
# needed so the install doesn't fail on ignored build scripts.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ----- build -------------------------------------------------------------
# NEXT_PUBLIC_* values are inlined at build time. API calls are client-side
# (from the browser), so the base URL must be host-reachable — it defaults to
# the backend's published port, NOT the compose-internal hostname.
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ----- runtime -----------------------------------------------------------
# Serves the standalone output (next.config.ts: output: "standalone") as a
# non-root user. No node_modules needed beyond what standalone bundles.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN useradd --system --uid 10001 appuser
COPY --from=build --chown=appuser:appuser /app/.next/standalone ./
COPY --from=build --chown=appuser:appuser /app/.next/static ./.next/static
COPY --from=build --chown=appuser:appuser /app/public ./public
USER appuser
EXPOSE 3000
CMD ["node", "server.js"]
