import { Link, useAsyncError } from "@remix-run/react";

export function DeferredRouteAwaitError({ retryTo }: { retryTo: string }) {
  const err = useAsyncError();
  const message =
    err instanceof Error
      ? err.message
      : "Something went wrong loading this page.";

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-6 text-center">
        <p className="text-destructive mb-4 text-sm font-medium">{message}</p>
        <Link
          to={retryTo}
          className="text-primary text-sm font-medium underline underline-offset-4"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
