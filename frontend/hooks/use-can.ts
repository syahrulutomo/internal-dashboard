"use client";

import { useAuth } from "@/hooks/use-auth";
import { can, type Permission } from "@/libs/permissions";

// useCan is the component-facing RBAC check: it reads the current session's role
// and reports whether that role holds `permission`. Use it to gate CTAs, e.g.
// `const canExport = useCan("payments:export")`. Remember this only hides UI —
// the server is the real authorization boundary (see libs/permissions.ts).
export function useCan(permission: Permission): boolean {
  const { user } = useAuth();
  return can(user?.role, permission);
}
