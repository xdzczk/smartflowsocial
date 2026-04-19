import { useEffect, useState } from "react";

import type {
  SignerNudgeDetail,
  SignerNudgePhase,
} from "~/lib/nostr-adapter.client";

/**
 * Live status for the in-flight sign cycle. The composer surfaces this so the
 * user sees a phase-aware message ("Still waiting · 12s", "Reconnecting to
 * signer · 16s") instead of a static spinner. Driven entirely by the
 * `signer-nudge` events emitted by the adapter — there is no per-attempt
 * counter anymore (the adapter does at most one initial attempt + one
 * reconnect-and-retry, and the UI describes that via `phase`, not numbers).
 */
export interface SignAttemptProgress {
  startedAt: number;
  /** Soft target for the whole sign cycle (display only). */
  timeoutMs?: number;
  phase: SignerNudgePhase;
}

function formatElapsed(elapsedSeconds: number, timeoutMs?: number): string {
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
  const elapsed = formatElapsed(elapsedSeconds, timeoutMs);
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

/**
 * Returns true once the signer has been waiting long enough that the UI
 * should hint at manual recovery (e.g. "If your session expired, reconnect
 * from Settings"). Pre-`reconnect` we keep the banner minimal because the
 * shared pool + bounded RPC layer usually completes a sign within a couple
 * of seconds and we don't want to surface scary recovery copy too eagerly.
 */
export function shouldShowManualRecovery(
  phase: SignerNudgePhase | undefined
): boolean {
  return phase === "reconnect" || phase === "fail";
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
