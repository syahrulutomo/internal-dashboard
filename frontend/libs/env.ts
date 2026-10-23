// Client-side configuration. NEXT_PUBLIC_* vars are inlined at build time, so
// the Docker image receives this as a build arg (see frontend/Dockerfile).
// Defaults to the local backend so `pnpm dev` works with zero config.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
