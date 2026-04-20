/**
 * Tier selector for ephemeral signing-attempt UI (PR 4).
 *
 * Encapsulates the "subtle now, compact after EPHEMERAL_ESCALATION_MS"
 * presentation rule so each call site can render unconditionally:
 *
 *     const tier = useEphemeralSignTier(attempt);
 *     return (
 *       <>
 *         <LikeButton onClick={...} />
 *         {tier === "subtle" && <SubtleSignPending attempt={attempt} />}
 *         {tier === "compact" && <CompactSignStatus attempt={attempt} />}
 *       </>
 *     );
 *
 * Tier rules:
 *   - `null`: attempt is missing, terminal, or not relevant to display.
 *   - `"subtle"`: attempt is in `signing` / `resuming` / `submitting`,
 *     OR in `awaiting_signer` for less than {@link EPHEMERAL_ESCALATION_MS}.
 *   - `"compact"`: attempt is in `awaiting_signer` for at least
 *     {@link EPHEMERAL_ESCALATION_MS}, or in `expired`.
 *
 * Durable attempts are intentionally NOT auto-escalated — their host UI
 * decides whether to render the foreground banner or the compact pill.
 * The hook still returns `"compact"` for any non-ephemeral
 * `awaiting_signer`/`expired`, so per-row durable surfaces can opt in by
 * just consuming this hook directly.
 */

import { useEffect, useState } from "react";

import {
  EPHEMERAL_ESCALATION_MS,
  type SigningAttempt,
} from "./signing-attempts.client";

export type EphemeralSignTier = "subtle" | "compact" | null;

export function useEphemeralSignTier(
  attempt: SigningAttempt | null
): EphemeralSignTier {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (attempt?.state !== "awaiting_signer" || attempt.awaitingSince == null) {
      return;
    }
    // Already past the escalation point — no need to re-tick.
    const elapsed = Date.now() - attempt.awaitingSince;
    if (elapsed >= EPHEMERAL_ESCALATION_MS) return;
    const remaining = EPHEMERAL_ESCALATION_MS - elapsed;
    const handle = setTimeout(() => setNow(Date.now()), remaining);
    return () => clearTimeout(handle);
  }, [attempt]);

  if (!attempt) return null;
  if (
    attempt.state === "completed" ||
    attempt.state === "failed" ||
    attempt.state === "idle"
  ) {
    return null;
  }
  if (attempt.state === "expired") return "compact";

  if (attempt.state === "awaiting_signer") {
    if (attempt.awaitingSince == null) return "subtle";
    const elapsed = now - attempt.awaitingSince;
    return elapsed >= EPHEMERAL_ESCALATION_MS ? "compact" : "subtle";
  }
  return "subtle";
}
