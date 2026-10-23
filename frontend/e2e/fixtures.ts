// Shared constants for the e2e suite. The expected figures are not magic
// numbers: they are derived from the backend's deterministic seed
// (`backend/main.go#seedPayments`) — 48 payments on a fixed 13-step status
// pattern — so every fresh run produces exactly these counts.

export const CS_USER = {
  email: "cs@test.com",
  password: "password",
  // Derived from the email local-part by `Topbar#displayName`/`initials`.
  displayName: "Cs",
  roleLabel: "Cs",
} as const;

// Operations analyst — the role permitted to export payments (RBAC).
export const OPERATION_USER = {
  email: "operation@test.com",
  password: "password",
  displayName: "Operation",
  roleLabel: "Operation",
} as const;

// Seeded payment distribution. completed(30) + processing(11) + failed(7) = 48.
export const SEED = {
  total: 48,
  completed: 30,
  processing: 11,
  failed: 7,
  pageSize: 10,
  // ceil(48 / 10)
  totalPages: 5,
} as const;

// Name of the cookie the auth layer persists the session under
// (`libs/auth-storage.ts`); its value is URL-encoded JSON {email, role, token}.
export const TOKEN_KEY = "internal_token";

export const STORAGE_STATE_CS = "e2e/.auth/cs.json";
export const STORAGE_STATE_OP = "e2e/.auth/operation.json";
