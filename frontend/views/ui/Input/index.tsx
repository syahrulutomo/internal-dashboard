import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/libs/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  // Decorative icon rendered inside the field on the left.
  leadingIcon?: ReactNode;
  // Interactive element rendered inside the field on the right (e.g. a toggle).
  trailing?: ReactNode;
}

export function Input({
  label,
  error,
  id,
  className,
  leadingIcon,
  trailing,
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-900">
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-gray-400">
            {leadingIcon}
          </span>
        )}
        <input
          id={id}
          className={cn(
            "h-12 w-full rounded-xl border border-[var(--border)] bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-2 focus:outline-brand-500/25 disabled:bg-gray-50",
            leadingIcon ? "pl-11" : "pl-3.5",
            trailing ? "pr-11" : "pr-3.5",
            error &&
              "border-red-400 focus:border-red-500 focus:outline-red-500/30",
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error && id ? `${id}-error` : undefined}
          {...props}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-0 grid w-11 place-items-center text-gray-400">
            {trailing}
          </span>
        )}
      </div>
      {error && (
        <p id={id ? `${id}-error` : undefined} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
