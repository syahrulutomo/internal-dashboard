"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/views/ui/Button";
import { Input } from "@/views/ui/Input";
import {
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
} from "@/views/ui/Icons";
import type { LoginRequest } from "@/libs/types";

interface LoginFormProps {
  onSubmit: (credentials: LoginRequest) => void;
  loading?: boolean;
  // When set (e.g. during the post-429 cooldown), the form is locked and the
  // submit button shows this label instead of "Sign in".
  disabled?: boolean;
  cooldownLabel?: string;
}

// Minimal email shape check — the server is the source of truth, this only
// catches obvious typos before a round-trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Dumb, controlled form. All state is local; submission and async concerns
// (including surfacing server errors as toasts) are delegated to the container
// via props.
export function LoginForm({
  onSubmit,
  loading,
  disabled = false,
  cooldownLabel,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Field-level validation messages, shown only after a submit attempt so the
  // form doesn't scold the user mid-typing.
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const validate = (): boolean => {
    const next: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = "Email is required.";
    else if (!EMAIL_RE.test(trimmedEmail))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (!validate()) return;
    onSubmit({ email: email.trim(), password });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <Input
        id="email"
        type="email"
        label="Email"
        placeholder="you@company.id"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        leadingIcon={<MailIcon className="size-5" />}
        autoComplete="email"
        disabled={disabled}
        required
      />
      <Input
        id="password"
        type={showPassword ? "text" : "password"}
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        leadingIcon={<LockIcon className="size-5" />}
        disabled={disabled}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="pointer-events-auto grid size-full place-items-center rounded-r-xl text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500/40"
          >
            {showPassword ? (
              <EyeOffIcon className="size-5" />
            ) : (
              <EyeIcon className="size-5" />
            )}
          </button>
        }
        autoComplete="current-password"
        required
      />

      <Button
        type="submit"
        loading={loading}
        disabled={disabled}
        className="mt-1 w-full"
      >
        {disabled && cooldownLabel
          ? cooldownLabel
          : loading
            ? "Signing in…"
            : "Sign in"}
        {!loading && !disabled && <ArrowRightIcon className="size-4" />}
      </Button>
    </form>
  );
}
