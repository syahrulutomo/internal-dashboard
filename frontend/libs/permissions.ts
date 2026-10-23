import RBAC from "@rbac/rbac";
import { ROLES, type UserRole } from "./types";

// Client-side RBAC: which permissions each role holds. This drives *UX* only —
// hiding a CTA a user can't action. It is NOT a security boundary: a user could
// tamper with their stored role to reveal a hidden control. Every permission
// gated here MUST also be enforced server-side (e.g. `payments:export` is
// authorized by the Go API, which returns 403 to an unauthorized role). Keep the
// two in lockstep: the client hides, the server enforces.

// The capabilities a role may hold. Add new CTAs here as the dashboard grows.
// Use these constants instead of the bare permission strings at call sites
// (e.g. `useCan(PERMISSIONS.PAYMENTS_EXPORT)`).
export const PERMISSIONS = {
  PAYMENTS_EXPORT: "payments:export",
  PAYMENTS_SUMMARY: "payments:summary",
  PAYMENTS_VIEW: "payments:view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Single source of truth for role → permissions. A role with no entry (or an
// empty list) holds nothing. This table also seeds the @rbac/rbac instance
// below, so the policy lives in exactly one place.
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [ROLES.OPERATION]: [PERMISSIONS.PAYMENTS_EXPORT, PERMISSIONS.PAYMENTS_SUMMARY, PERMISSIONS.PAYMENTS_VIEW],
  [ROLES.CS]: [PERMISSIONS.PAYMENTS_VIEW],
};

// Build the @rbac/rbac role config from ROLE_PERMISSIONS. @rbac/rbac is the
// engine that answers "can this role do X?" (supporting wildcards/inheritance
// should the policy grow); ROLE_PERMISSIONS stays the declarative source.
const roles = Object.fromEntries(
  Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => [
    role,
    { can: [...permissions] },
  ]),
);

// enableLogger off: the default logger prints every check to the console, which
// is noise in the browser.
const rbac = RBAC({ enableLogger: false })(roles);

// can reports whether the given role holds a permission, delegating to the
// @rbac/rbac engine. It is async because @rbac/rbac supports conditional
// ("when") rules that may resolve asynchronously. A null/undefined role (no
// session) holds nothing and resolves false without consulting the engine.
export async function can(
  role: UserRole | null | undefined,
  permission: Permission,
): Promise<boolean> {
  if (!role) return false;
  return rbac.can(role, permission);
}
