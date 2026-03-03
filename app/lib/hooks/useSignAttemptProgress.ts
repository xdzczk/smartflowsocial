import { useEffect, useState } from "react";

export interface SignAttemptProgress {
  attempt: number;
  maxAttempts: number;
  startedAt: number;
  /** Max duration for this attempt before switching to next (ms). Enables "12s/40s" display. Omit for backward compat. */
  timeoutMs?: number;
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
 * Subscribes to nostr-sign-attempt events from the signing adapter and tracks
 * elapsed time so composers can show "Attempt X of Y · 12s/40s" while waiting for signer.
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
      const ev = e as CustomEvent<SignAttemptProgress>;
      const d = ev.detail;
      setSignAttempt({
        attempt: d.attempt,
        maxAttempts: d.maxAttempts,
        startedAt: d.startedAt,
        timeoutMs: d.timeoutMs,
      });
    };
    window.addEventListener("nostr-sign-attempt", handler);
    return () => window.removeEventListener("nostr-sign-attempt", handler);
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
