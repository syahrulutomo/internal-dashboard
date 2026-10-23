// Minimal className combiner — joins truthy values with a space. Keeps the UI
// layer dependency-free (no clsx/tailwind-merge needed for this app's scope).
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
