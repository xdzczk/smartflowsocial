/**
 * Composer signer reconnect: clear stuck "Waiting for signer approval" on healthy event,
 * optionally retry the in-flight sign with the new signer, and try background reconnect
 * periodically while awaiting signer.
 * Used by UnifiedComposer, DraftBulkResume, SimpleRescheduleModal.
 */

import { useEffect } from "react";

import { tryBackgroundReconnect } from "~/features/auth/signer";

const AWAITING_SIGNER_RECONNECT_INTERVAL_MS = 10_000;
const AWAITING_SIGNER_MAX_RECONNECT_ATTEMPTS = 5;

export function useComposerSignerReconnect(
  clearSigningState: () => void,
  isSigning: boolean,
  /** When provided, called after clearSigningState on healthy event so the composer can retry the in-flight sign with the new signer. */
  onHealthyWhileSigning?: () => void
): void {
  useEffect(() => {
    const handler = () => {
      clearSigningState();
      onHealthyWhileSigning?.();
    };
    window.addEventListener("nostr-connection-healthy", handler);
    return () =>
      window.removeEventListener("nostr-connection-healthy", handler);
  }, [clearSigningState, onHealthyWhileSigning]);

  useEffect(() => {
    if (!isSigning) return;
    let attempts = 0;
    const interval = setInterval(() => {
      void tryBackgroundReconnect();
      attempts++;
      if (attempts >= AWAITING_SIGNER_MAX_RECONNECT_ATTEMPTS)
        clearInterval(interval);
    }, AWAITING_SIGNER_RECONNECT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isSigning]);
}
