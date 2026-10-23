// Client-side login lockout after the API rate-limits a user (HTTP 429).
// The deadline is persisted in localStorage so a page refresh can't bypass it,
// and exposed as a tiny external store (like auth-storage) so React can read it
// via useSyncExternalStore — SSR-safe, with cross-tab sync.

const KEY = "login_cooldown_until";

let cache = 0;
let initialized = false;
const listeners = new Set<() => void>();

// Reads the stored deadline, treating a past/invalid value as "no cooldown".
function read(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > Date.now() ? n : 0;
}

function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") return;
  cache = read();
  initialized = true;
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      cache = read();
      emit();
    }
  });
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeCooldown(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCooldownUntil(): number {
  ensureInitialized();
  return cache;
}

export function getServerCooldownUntil(): number {
  return 0;
}

// Starts (or extends) the lockout for `ms` milliseconds from now.
export function startCooldown(ms: number): void {
  if (typeof window === "undefined") return;
  cache = Date.now() + ms;
  window.localStorage.setItem(KEY, String(cache));
  emit();
}

export function clearCooldown(): void {
  if (typeof window === "undefined") return;
  cache = 0;
  window.localStorage.removeItem(KEY);
  emit();
}
