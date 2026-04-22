/**
 * Foreground sign-recovery banner.
 *
 * Surfaces the currently-active {@link SigningAttempt} to the user when a
 * publish click stalled on the remote signer. Today the only producer is
 * the composer publish flow; PR 2/3 of the unified signing-recovery effort
 * widen this to other durable intents (reschedule, edit, etc.) — at which
 * point the host of this banner moves into a global toast region rather
 * than living inside `UnifiedComposer`.
 *
 * States rendered:
 *
 *   - `awaiting_signer`: signer was unavailable when we tried to sign.
 *     Shows a friendly "we'll resume automatically" message with a live
 *     countdown of the remaining recovery window, plus explicit
 *     `Resume now` / `Cancel attempt` controls.
 *   - `resuming`: a `nostr-connection-healthy` event arrived inside the
 *     window and we're re-running the original sign+submit.
 *   - `expired`: the recovery window elapsed without a successful sign.
 *     The user must click `Retry` to start a fresh attempt — we never
 *     autocomplete an expired attempt because the original click intent
 *     may be stale.
 *
 * All states are render-only here; transitions are owned by
 * `signing-attempts.client.ts`.
 *
 * History: this component was previously located at
 * `app/features/posts/composer/components/composer/PendingPublishBanner.tsx`.
 * The old path remains as a re-export shim (with a dev-time deprecation
 * warning) for one release.
 */

import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";

import {
  pendingPublish,
  type PendingPublishAttempt,
} from "../signing-attempts.client";

interface ForegroundSignRecoveryBannerProps {
  attempt: PendingPublishAttempt | null;
  /**
   * Re-runs the most recent submit so the user can manually retry an expired
   * attempt. When omitted (e.g. for the global mount, which has no per-call-site
   * retry path), the `Retry` button is hidden in the `expired` state and the
   * user is instead asked to re-trigger from the original surface.
   */
  onRetryClick?: () => void;
  inRail?: boolean;
}

function formatRemaining(remainingMs: number): string {
  const safe = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function ForegroundSignRecoveryBanner({
  attempt,
  onRetryClick,
  inRail = false,
}: ForegroundSignRecoveryBannerProps) {
  // Hold a wall-clock snapshot in state and refresh it every second so the
  // countdown rerender is driven by a state change, not by reading the
  // impure `Date.now()` during render. This satisfies React's purity
  // contract (`react-hooks/purity`) and keeps the tick localised: only
  // this banner re-renders, not the rest of the composer.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (attempt?.state !== "awaiting_signer" || attempt.resumeUntil == null) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [attempt]);

  if (!attempt) return null;
  if (
    attempt.state !== "awaiting_signer" &&
    attempt.state !== "resuming" &&
    attempt.state !== "expired"
  ) {
    return null;
  }

  const containerBaseClass = inRail
    ? "rounded-lg border p-2.5 text-xs"
    : "mb-3 rounded-md border p-3 text-sm";

  if (attempt.state === "awaiting_signer") {
    const remainingMs =
      attempt.resumeUntil != null ? attempt.resumeUntil - now : 0;
    return (
      <div
        role="status"
        aria-live="polite"
        className={`${containerBaseClass} border-warning/50 bg-warning/10 text-warning-text flex items-center justify-between gap-2`}
      >
        <span className="flex-1">
          Signer unavailable — we&rsquo;ll resume this publish automatically
          when you reconnect ({formatRemaining(remainingMs)} left).
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              pendingPublish.maybeResume();
            }}
          >
            Resume now
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              pendingPublish.cancel();
            }}
          >
            Cancel attempt
          </Button>
        </div>
      </div>
    );
  }

  if (attempt.state === "resuming") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`${containerBaseClass} bg-surface-hover/30 text-text-secondary flex items-center gap-2`}
      >
        <span>Reconnected — completing your publish…</span>
      </div>
    );
  }

  // expired
  const expiredCopy = onRetryClick
    ? "Recovery window expired before your signer reconnected. Click Retry to re-sign and publish."
    : "Recovery window expired before your signer reconnected. Re-trigger this action to try again.";
  return (
    <Alert
      variant="destructive"
      className={
        inRail
          ? "flex flex-row items-center justify-between gap-2 py-2.5"
          : "mb-3 flex flex-row items-center justify-between gap-2"
      }
    >
      <AlertDescription className="flex-1">{expiredCopy}</AlertDescription>
      <div className="flex shrink-0 items-center gap-2">
        {onRetryClick ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              pendingPublish.cancel();
              onRetryClick();
            }}
          >
            Retry
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            pendingPublish.cancel();
          }}
        >
          Discard
        </Button>
      </div>
    </Alert>
  );
}

/**
 * @deprecated Renamed to {@link ForegroundSignRecoveryBanner}. The old name is
 * kept as an alias so the legacy import path
 * `~/features/posts/composer/components/composer/PendingPublishBanner` keeps
 * working through PR 1's deprecation window.
 */
export const PendingPublishBanner = ForegroundSignRecoveryBanner;
