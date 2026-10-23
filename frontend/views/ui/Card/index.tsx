import type { HTMLAttributes } from "react";
import { cn } from "@/libs/cn";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
