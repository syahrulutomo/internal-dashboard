import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime image can ship just the server + static assets, no node_modules.
  output: "standalone",
  // This dashboard is fully client-rendered (auth-gated, per-user data fetched
  // via TanStack Query), so the experimental caching/prefetch flags add risk
  // without benefit. Keeping the config minimal makes `next build` reliable on
  // a reviewer's machine.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
