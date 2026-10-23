"use client";

import { Button } from "@/views/ui/Button";
import type { AuthUser } from "@/libs/types";

interface TopbarProps {
  user: AuthUser;
  onLogout: () => void;
}

// Derive a human display name from the email local-part, e.g.
// "rina.wijaya@durianpay.id" -> "Rina Wijaya". The backend only returns an
// email + role, so this is the best we can do without a profile endpoint.
function displayName(email: string): string {
  const local = email.split("@")[0] ?? email;
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || email
  );
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase() || "?";
}

export function Topbar({ user, onLogout }: TopbarProps) {
  const name = displayName(user.email);
  const roleLabel =
    user.role.charAt(0).toUpperCase() + user.role.slice(1);

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-5 lg:px-10">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-2 text-[var(--muted)]">
          <li>Monitoring</li>
          <li aria-hidden className="text-gray-300">
            /
          </li>
          <li className="font-semibold text-gray-900">Payments</li>
        </ol>
      </nav>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 rounded-full border border-[var(--border)] bg-white py-1.5 pl-1.5 pr-3 shadow-sm">
          <span className="grid size-8 place-items-center rounded-full bg-brand-800 text-xs font-semibold text-white">
            {initials(name)}
          </span>
          <div className="hidden text-left leading-tight sm:block">
            <p className="text-sm font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-[var(--muted)]">{roleLabel}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onLogout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
