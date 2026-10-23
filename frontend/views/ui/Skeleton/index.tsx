import { cn } from "@/libs/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200/80", className)}
      aria-hidden
    />
  );
}
