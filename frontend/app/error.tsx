"use client";

import { useEffect } from "react";
import { Button } from "@/views/ui/Button";

// Route-segment error boundary. Next.js App Router renders this when a render
// or data error escapes a route; it isolates the failure to the segment and
// offers a recovery path instead of a blank screen. API/query errors are
// handled inline in the containers — this catches the unexpected.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for observability (wire to Sentry/etc. in production).
    console.error("Unhandled UI error:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="grid min-h-screen place-items-center p-6 text-center"
    >
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          An unexpected error occurred while rendering this page. You can try
          again; if it keeps happening, contact your team lead.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
