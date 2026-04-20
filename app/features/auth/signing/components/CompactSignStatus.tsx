/**
 * Compact in-row signing status pill.
 *
 * Tier-2 of the signing presentation:
 *   - For **ephemeral** attempts (reactions, search engagements): rendered
 *     after {@link EPHEMERAL_ESCALATION_MS} of `awaiting_signer` so the
 *     user gets a Resume / Cancel affordance without escalating to the
 *     full foreground banner.
 *   - For **durable** attempts whose host doesn't want the global banner
 *     (per-row reschedule status, settings rows, etc.): rendered while
 *     the attempt is in any non-terminal "needs UI" state.
 *
 * Keep the surface area small. The foreground banner
 * (`ForegroundSignRecoveryBanner`) owns the verbose "Recovery window
 * expired" copy and the modal-sized Retry/Discard interaction; this
 * component is a tight one-liner suitable for in-row contexts.
 */

import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import {
  signingAttempts,
  type SigningAttempt,
} from "../signing-attempts.client";

export interface CompactSignStatusProps {
  attempt: SigningAttempt | null;
  /** Optional override for the verb shown in the message ("Like", "Reply", …). */
  actionLabel?: string;
  /** Optional className appended to the wrapper. */
  className?: string;
}

function formatRemainingSeconds(remainingMs: number): string {
  const safe = Math.max(0, remainingMs);
  const totalSeconds = Math.ceil(safe / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function CompactSignStatus({
  attempt,
  actionLabel,
  className,
}: CompactSignStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (attempt?.state !== "awaiting_signer" || attempt.resumeUntil == null) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [attempt]);

  if (!attempt) return null;
  const verb = actionLabel ?? attempt.intent.label;

  if (attempt.state === "awaiting_signer") {
    const remainingMs =
      attempt.resumeUntil != null ? attempt.resumeUntil - now : 0;
    return (
      <span
        role="status"
        aria-live="polite"
        data-testid="compact-sign-status"
        data-state="awaiting_signer"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-900 dark:text-amber-200",
          className
        )}
      >
        <span className="leading-none">
          Signer offline · {formatRemainingSeconds(remainingMs)} left
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Resume ${verb} now`}
          className="h-5 px-1.5 text-xs"
          onClick={() => {
            signingAttempts.maybeResume();
          }}
        >
          Resume
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Cancel ${verb}`}
          className="h-5 px-1.5 text-xs"
          onClick={() => {
            signingAttempts.cancelAttempt(attempt.attemptId);
          }}
        >
          Cancel
        </Button>
      </span>
    );
  }

  if (attempt.state === "resuming" || attempt.state === "submitting") {
    return (
      <span
        role="status"
        aria-live="polite"
        data-testid="compact-sign-status"
        data-state={attempt.state}
        className={cn(
          "text-muted-foreground inline-flex items-center text-xs",
          className
        )}
      >
        Reconnected — completing {verb.toLowerCase()}…
      </span>
    );
  }

  if (attempt.state === "expired") {
    return (
      <span
        role="status"
        aria-live="polite"
        data-testid="compact-sign-status"
        data-state="expired"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-300",
          className
        )}
      >
        <span className="leading-none">{verb} timed out</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Dismiss ${verb}`}
          className="h-5 px-1.5 text-xs"
          onClick={() => {
            signingAttempts.cancelAttempt(attempt.attemptId);
          }}
        >
          Dismiss
        </Button>
      </span>
    );
  }

  return null;
}
