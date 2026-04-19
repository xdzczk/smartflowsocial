/**
 * Composer signer reconnect: clear stuck "Waiting for signer approval" on healthy event,
 * and optionally retry the in-flight sign with the new signer.
 * Used by UnifiedComposer, DraftBulkResume, RescheduleScheduledPostModal.
 *
 * On "nostr-connection-healthy", the retry callback runs first so it can read any pending
 * retry ref; if it returns true (retry started), we skip clearSigningState so we do not clear
 * isSigning or drop the new submit. Previously clearSigningState ran first and wiped the
 * retry ref, so reconnect after a stale NIP-46 session never resubmitted.
 *
 * We do NOT run any background-reconnect interval here. The signer adapter is single-shot
 * (one attempt per user click); if the bunker is unresponsive the user sees a single
 * error and an explicit "Reconnect signer" button. This matches Ditto's behaviour and
 * stops the periodic-retry storm we used to fire while awaiting signer approval.
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
