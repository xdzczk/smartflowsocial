import { Link, useAsyncError } from "@remix-run/react";

/**
 * Remix &lt;Await errorElement&gt; surface for the deferred engagement payload.
 */
export function EngagementFeedAwaitError() {
  const err = useAsyncError();
  const message =
    err instanceof Error
      ? err.message
      : "Something went wrong loading the engagement feed.";

  return (
    <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-6 text-center">
      <p className="text-destructive mb-4 text-sm font-medium">{message}</p>
      <Link
        to="/dashboard/engagement/feed"
        className="text-primary text-sm font-medium underline underline-offset-4"
      >
        Try again
      </Link>
    </div>
  );
}
