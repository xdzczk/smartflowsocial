/**
 * Composer signer reconnect: clear stuck "Waiting for signer approval" on healthy event,
 * and try background reconnect periodically while awaiting signer.
 * Used by UnifiedComposer, DraftBulkResume, SimpleRescheduleModal.
 */

import { useEffect } from "react";

import { tryBackgroundReconnect } from "~/features/auth/signer";

const AWAITING_SIGNER_RECONNECT_INTERVAL_MS = 10_000;
const AWAITING_SIGNER_MAX_RECONNECT_ATTEMPTS = 5;

export function useComposerSignerReconnect(
  clearSigningState: () => void,
  isSigning: boolean
): void {
  useEffect(() => {
    const handler = () => clearSigningState();
    window.addEventListener("nostr-connection-healthy", handler);
    return () =>
      window.removeEventListener("nostr-connection-healthy", handler);
  }, [clearSigningState]);

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
