import type { ReactNode } from "react";
import { cn } from "@/libs/cn";

type Tone = "success" | "warning" | "danger" | "neutral";

const tones: Record<Tone, string> = {
  success: "bg-brand-50 text-brand-700 ring-brand-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  neutral: "bg-gray-100 text-gray-600 ring-gray-500/20",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
