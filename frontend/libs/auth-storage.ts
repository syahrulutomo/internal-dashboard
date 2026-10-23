import type { AuthUser } from "./types";

// Persisted auth state lives in a cookie so a page refresh keeps the user
// logged in and the session is sent on same-site navigations. This module
// exposes it as a tiny external store so React can read it via
// useSyncExternalStore (SSR-safe, no setState-in-effect hydration), and so the
// api-client can read the token at request time without going through React.
// The cookie is intentionally NOT HttpOnly: the client reads the JWT to attach
// it as a bearer token on API calls.

const TOKEN_KEY = "internal_token";
// Keep the session for a week; refreshed on every save.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

let cache: AuthUser | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const row = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix));
  return row ? decodeURIComponent(row.slice(prefix.length)) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function readStorage(): AuthUser | null {
  const raw = readCookie(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

// Lazily hydrate the cache from the cookie the first time the store is read or
// subscribed to on the client.
function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") return;
  cache = readStorage();
  initialized = true;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeAuth(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Stable snapshot: the reference only changes when saveAuth/clearAuth mutate the
// cache, which is what useSyncExternalStore needs.
export function getAuthSnapshot(): AuthUser | null {
  ensureInitialized();
  return cache;
}

// On the server there is no session; always null so markup matches the client's
// first (pre-hydration) render.
export function getServerAuthSnapshot(): AuthUser | null {
  return null;
}

export function saveAuth(user: AuthUser): void {
  if (typeof window === "undefined") return;
  writeCookie(TOKEN_KEY, JSON.stringify(user));
  cache = user;
  emit();
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  deleteCookie(TOKEN_KEY);
  cache = null;
  emit();
}

export function getToken(): string | null {
  return getAuthSnapshot()?.token ?? null;
}
