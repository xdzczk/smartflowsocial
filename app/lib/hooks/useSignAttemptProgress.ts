import { useEffect, useState } from "react";

import type {
  SignerNudgeDetail,
  SignerNudgePhase,
} from "~/lib/nostr-adapter.client";

/**
 * Stable shape consumed by composer surfaces. `phase` mirrors the underlying
 * `signer-nudge` event from the adapter; `attempt`/`maxAttempts` are kept for
 * backwards compatibility with display strings but are now derived purely from
 * the phase (start/nudge → 1, reconnect → 2).
 */
export interface SignAttemptProgress {
  attempt: number;
  maxAttempts: number;
  startedAt: number;
  /** Soft target for the whole sign cycle (display only). */
  timeoutMs?: number;
  phase: SignerNudgePhase;
}

/** Format elapsed and optional max for display, e.g. "12s" or "12s/40s". */
export function formatAttemptElapsed(
  elapsedSeconds: number,
  timeoutMs?: number
): string {
  if (timeoutMs != null && timeoutMs > 0) {
    const maxSeconds = Math.ceil(timeoutMs / 1000);
    return `${elapsedSeconds}s/${maxSeconds}s`;
  }
  return `${elapsedSeconds}s`;
}

/**
 * Map a signer-nudge phase to a user-facing status copy fragment.
 * Composers can append this to "Waiting for signer…" without baking in a
 * fixed retry counter.
 */
export function describeSignerPhase(
  phase: SignerNudgePhase | undefined,
  elapsedSeconds: number,
  timeoutMs?: number
): string | null {
  if (!phase || phase === "start" || phase === "done") return null;
  const elapsed = formatAttemptElapsed(elapsedSeconds, timeoutMs);
  switch (phase) {
    case "nudge":
      return `Still waiting · ${elapsed}`;
    case "reconnect":
      return `Reconnecting to signer · ${elapsed}`;
    case "fail":
      return `Signer didn't respond · ${elapsed}`;
    default:
      return null;
  }
}

function attemptForPhase(phase: SignerNudgePhase): number {
  return phase === "reconnect" ? 2 : 1;
}

/**
 * Subscribes to `signer-nudge` events from the signing adapter and tracks
 * elapsed time so composers can show a live status while waiting for the
 * signer (e.g. "Waiting for signer approval… Still waiting · 12s/60s").
 */
export function useSignAttemptProgress(isSigning: boolean): {
  signAttempt: SignAttemptProgress | null;
  signElapsedSeconds: number;
} {
  const [signAttempt, setSignAttempt] = useState<SignAttemptProgress | null>(
    null
  );
  const [signElapsedSeconds, setSignElapsedSeconds] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<SignerNudgeDetail>;
      const d = ev.detail;
      if (d.phase === "done" || d.phase === "fail") {
        setSignAttempt(null);
        setSignElapsedSeconds(0);
        return;
      }
      setSignAttempt({
        attempt: attemptForPhase(d.phase),
        maxAttempts: 2,
        startedAt: d.startedAt,
        timeoutMs: d.timeoutMs,
        phase: d.phase,
      });
    };
    window.addEventListener("signer-nudge", handler);
    return () => window.removeEventListener("signer-nudge", handler);
  }, []);

  useEffect(() => {
    if (!isSigning) {
      queueMicrotask(() => {
        setSignAttempt(null);
        setSignElapsedSeconds(0);
      });
    }
  }, [isSigning]);

  useEffect(() => {
    if (!isSigning || !signAttempt) return;
    const startedAt = signAttempt.startedAt;
    const tick = () =>
      setSignElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    queueMicrotask(tick);
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isSigning, signAttempt]);

  return { signAttempt, signElapsedSeconds };
}
