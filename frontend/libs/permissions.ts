import type { UserRole } from "./types";

// Client-side RBAC: which permissions each role holds. This drives *UX* only —
// hiding a CTA a user can't action. It is NOT a security boundary: a user could
// tamper with their stored role to reveal a hidden control. Every permission
// gated here MUST also be enforced server-side (e.g. `payments:export` is
// authorized by the Go API, which returns 403 to an unauthorized role). Keep the
// two in lockstep: the client hides, the server enforces.

// A capability a role may hold. Add new CTAs here as the dashboard grows.
export type Permission = "payments:export";

// Single source of truth for role → permissions. A role with no entry (or an
// empty list) holds nothing.
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  operation: ["payments:export"],
  cs: [],
};

// can reports whether the given role holds a permission. A null/undefined role
// (no session) holds nothing.
export function can(
  role: UserRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
