/**
 * Composer signer reconnect: clear stuck "Waiting for signer approval" on healthy event,
 * and optionally retry the in-flight sign with the new signer.
 * Used by UnifiedComposer, DraftBulkResume, SimpleRescheduleModal.
 *
 * We do not run periodic tryBackgroundReconnect while awaiting signer: it was interrupting
 * the in-flight sign every 10s (causing a retry and new sign-attempt event), which reset
 * the "Waiting for signer" timer and made the banner flicker. Reconnect still happens on
 * "nostr-connection-healthy" and after sign timeout/failure in the adapter.
 */

import { useEffect } from "react";

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
}
