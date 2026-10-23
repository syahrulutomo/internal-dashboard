"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin } from "@/services/auth";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useToast } from "@/hooks/use-toast";
import { useLoginCooldown } from "@/hooks/use-login-cooldown";
import { ApiError } from "@/libs/api-client";
import { startCooldown } from "@/libs/login-cooldown";
import { formatCountdown } from "@/libs/format";
import { LoginForm } from "@/views/presentation/LoginForm";
import { LoginHero } from "@/views/presentation/LoginHero";
import { Spinner } from "@/views/ui/Spinner";
import { ShieldIcon } from "@/views/ui/Icons";
import type { LoginRequest } from "@/libs/types";

// Lockout window applied after the API rate-limits login (HTTP 429).
const COOLDOWN_MS = 5 * 60 * 1000;

// Smart component: wires the login mutation to the auth session and navigation.
export function LoginContainer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setSession } = useAuth();
  const { ready, hydrated } = useAuthGuard("guest");
  const { toast } = useToast();
  const { isCoolingDown, remainingMs } = useLoginCooldown();
  const login = useLogin();

  const handleSubmit = (credentials: LoginRequest) => {
    if (isCoolingDown) return;
    login.mutate(credentials, {
      onSuccess: (user) => {
        setSession(user);
        // Start the new session from a clean cache. A previous logout clears the
        // cache too, but while the dashboard is still mounted during that
        // transition its (briefly still-enabled) queries can refetch without a
        // token and cache a client-side 401 *after* that clear. Clearing again
        // here drops any such stale error so it can't trip the dashboard's
        // "401 => sign out" guard on the fresh session.
        queryClient.clear();
        router.replace("/dashboard");
      },
      // API failures surface as toasts (not inline). A 429 additionally starts
      // the 5-minute cooldown that locks the form.
      onError: (err) => {
        if (err instanceof ApiError && err.status === 429) {
          startCooldown(COOLDOWN_MS);
          toast({
            variant: "error",
            title: "Too many attempts",
            description: "Please wait 5 minutes before trying to sign in again.",
          });
          return;
        }
        toast({
          variant: "error",
          title: "Sign in failed",
          description:
            err instanceof ApiError
              ? err.message
              : "Something went wrong. Please try again.",
        });
      },
    });
  };

  // Avoid flashing the form while the persisted session is being checked or
  // while redirecting an already-authenticated user.
  if (!hydrated || !ready) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="size-6 text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 sm:p-4 lg:p-5">
      <div className="grid min-h-[calc(100vh-2rem)] gap-6 lg:grid-cols-2">
        <LoginHero />

        <div className="flex items-center justify-center px-2 py-8 sm:px-8">
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-semibold text-gray-900">Sign in</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Use your internal account. What you can see depends on your role:
              CS or Operation.
            </p>

            <div className="mt-8">
              <LoginForm
                onSubmit={handleSubmit}
                loading={login.isPending}
                disabled={isCoolingDown}
                cooldownLabel={
                  isCoolingDown
                    ? `Try again in ${formatCountdown(remainingMs)}`
                    : undefined
                }
              />
            </div>

            <div className="my-8 border-t border-[var(--border)]" />

            <div className="flex items-start gap-3 text-sm text-[var(--muted)]">
              <ShieldIcon className="mt-0.5 size-5 shrink-0 text-gray-400" />
              <p className="leading-relaxed">
                Internal use only. Can&apos;t sign in? Ask your team lead to
                check your account and role.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
