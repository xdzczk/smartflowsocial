import { useEffect, useState } from "react";

export interface SignAttemptProgress {
  attempt: number;
  maxAttempts: number;
  startedAt: number;
}

/**
 * Subscribes to nostr-sign-attempt events from the signing adapter and tracks
 * elapsed time so composers can show "Attempt X of Y · Zs" while waiting for signer.
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
