/**
 * Subtle inline sign-pending indicator.
 *
 * Tier-1 of the ephemeral signing presentation (PR 4 of the unified
 * signing-recovery plan). Used while a `kind: "ephemeral"` attempt
 * (reaction, search lookup) is still optimistically resolvable: the user
 * sees a small spinner overlaid on the action they just clicked, with no
 * banner / toast / per-row pill noise.
 *
 * If the same attempt sits in `awaiting_signer` past
 * {@link EPHEMERAL_ESCALATION_MS}, the host should swap this for
 * {@link CompactSignStatus} so the user gets explicit Resume / Cancel
 * controls. The `useEphemeralSignTier` hook in
 * `use-ephemeral-sign-tier.client.ts` encapsulates that swap.
 *
 * This component renders nothing for non-ephemeral attempts, terminal
 * states, or `null` — the host can mount it unconditionally next to the
 * action button without branching on intent kind.
 */

import { Loader2 } from "lucide-react";

import { cn } from "~/lib/utils";

import type { SigningAttempt } from "../signing-attempts.client";

export interface SubtleSignPendingProps {
  attempt: SigningAttempt | null;
  /** Optional accessible label override; defaults to attempt.intent.label. */
  label?: string;
  className?: string;
}

export function SubtleSignPending({
  attempt,
  label,
  className,
}: SubtleSignPendingProps) {
  if (!attempt) return null;
  if (attempt.intent.kind !== "ephemeral") return null;
  if (
    attempt.state !== "signing" &&
    attempt.state !== "awaiting_signer" &&
    attempt.state !== "resuming" &&
    attempt.state !== "submitting"
  ) {
    return null;
  }
  const accessibleLabel = label ?? attempt.intent.label;
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`${accessibleLabel} pending`}
      className={cn("text-text-secondary inline-flex items-center", className)}
      data-testid="subtle-sign-pending"
      data-state={attempt.state}
    >
      <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
      <span className="sr-only">{accessibleLabel} pending</span>
    </span>
  );
}
