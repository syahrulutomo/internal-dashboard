import { QueryClient } from "@tanstack/react-query";

// Create a fresh client on the server for every render, and reuse a single
// client in the browser so the cache survives re-renders (per the Next.js
// TanStack Query guide).
let browserQueryClient: QueryClient | undefined;

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
