"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { can, type Permission } from "@/libs/permissions";

// useCan is the component-facing RBAC check: it reads the current session's role
// and reports whether that role holds `permission`. Use it to gate CTAs, e.g.
// `const canExport = useCan(PERMISSIONS.PAYMENTS_EXPORT)`. Remember this only hides UI —
// the server is the real authorization boundary (see libs/permissions.ts).
//
// The underlying @rbac/rbac check is async, so the result is resolved into
// state. It starts `false` (fail-closed): a gated control stays hidden for the
// brief tick before the check resolves, so an unauthorized user never sees it
// flash. The role comes from the auth context, which the dashboard keeps in sync
// with the server via GET /auth/me.
export function useCan(permission: Permission): boolean {
  const { user } = useAuth();
  const role = user?.role;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    can(role, permission).then((result) => {
      if (active) setAllowed(result);
    });
    return () => {
      active = false;
    };
  }, [role, permission]);

  return allowed;
}
