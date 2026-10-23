"use client";

import { useToast, type ToastVariant } from "@/hooks/use-toast";
import { AlertTriangleIcon, CheckIcon, CloseIcon, InfoIcon } from "@/views/ui/Icons";
import { cn } from "@/libs/cn";

// Per-variant styling + icon. Kept data-driven so adding a variant is one entry.
const variantStyles: Record<
  ToastVariant,
  { ring: string; icon: string; Icon: typeof AlertTriangleIcon }
> = {
  error: {
    ring: "ring-red-200 bg-red-50",
    icon: "text-red-600",
    Icon: AlertTriangleIcon,
  },
  success: {
    ring: "ring-emerald-200 bg-emerald-50",
    icon: "text-emerald-600",
    Icon: CheckIcon,
  },
  info: {
    ring: "ring-brand-200 bg-brand-50",
    icon: "text-brand-600",
    Icon: InfoIcon,
  },
};

// Renders the live toast stack. Fixed top-right on desktop, full-width on
// mobile. The region is an assertive live region so screen readers announce
// errors; each toast is a status row with a dismiss control.
export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
    >
      {toasts.map((t) => {
        const style = variantStyles[t.variant];
        const Icon = style.Icon;
        return (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-lg ring-1",
              style.ring,
            )}
          >
            <span className={cn("mt-0.5 shrink-0", style.icon)}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-sm text-gray-600">{t.description}</p>
              )}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-2 text-sm font-medium text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500/40"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500/40"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
