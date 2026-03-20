/**
 * Composer signer reconnect: clear stuck "Waiting for signer approval" on healthy event,
 * and optionally retry the in-flight sign with the new signer.
 * Used by UnifiedComposer, DraftBulkResume, SimpleRescheduleModal.
 *
 * On "nostr-connection-healthy", the retry callback runs first so it can read any pending
 * retry ref; if it returns true (retry started), we skip clearSigningState so we do not clear
 * isSigning or drop the new submit. Previously clearSigningState ran first and wiped the
 * retry ref, so reconnect after a stale NIP-46 session never resubmitted.
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
  /** When provided, runs first on healthy event; return true if a retry was started (skip clearSigningState). */
  onHealthyWhileSigning?: () => boolean
): void {
  useEffect(() => {
    const handler = () => {
      const retried = onHealthyWhileSigning?.() === true;
      if (!retried) {
        clearSigningState();
      }
    };
    window.addEventListener("nostr-connection-healthy", handler);
    return () =>
      window.removeEventListener("nostr-connection-healthy", handler);
  }, [clearSigningState, onHealthyWhileSigning]);
}
