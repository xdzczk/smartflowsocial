/**
 * Composer signer reconnect: clear stuck "Waiting for signer approval" on healthy event,
 * and optionally retry the in-flight sign with the new signer.
 *
 * Used by UnifiedComposer, DraftBulkResume, RescheduleScheduledPostModal.
 *
 * Resolution order on `nostr-connection-healthy`:
 *
 *  1. **Pending-publish state machine first.** If the composer registered a
 *     resumable publish attempt with `pendingPublish.start(...)`, we hand the
 *     reconnect back to the store via `pendingPublish.maybeResume()`. The
 *     store is the only place that knows whether the attempt is still inside
 *     its recovery window, whether it's already completed, and how to re-run
 *     the original sign+submit closure with the same `submissionId`. When the
 *     store actually starts a resume we stop here so the legacy retry path
 *     and `clearSigningState` can't race against it (this is the Scenario A
 *     vs Scenario B fix — both flows now collapse onto a single autocomplete
 *     path).
 *
 *  2. **Active-attempt guard.** Even when `maybeResume` is a no-op (e.g. the
 *     original sign call hasn't actually timed out yet, so the state machine
 *     is still in `signing` rather than `awaiting_signer`), we must NOT
 *     clear the local signing UI. Doing so exposes the Publish button while
 *     the original sign+submit is still in flight, and the user's "retry"
 *     click then races a brand-new `submissionId` against the original —
 *     which the server can't dedupe, producing duplicate publishes. The
 *     state machine owns the lifecycle until the in-flight sign settles
 *     (success → `submitting`/`completed`, transient failure → `awaiting_signer`,
 *     fatal failure → `failed`); the UI must stay parked until then.
 *
 *  3. **Caller-supplied retry callback** (legacy). For surfaces that haven't
 *     migrated to the store yet (e.g. RescheduleScheduledPostModal), we fall
 *     back to the existing behaviour: run the retry first, and only call
 *     `clearSigningState` if it didn't take.
 *
 *  4. **Fall through to `clearSigningState`** so the stuck "Waiting for
 *     signer approval" banner is cleared once the bunker is healthy again
 *     and there's nothing in flight to protect.
 *
 * We do NOT run any background-reconnect interval here. The signer adapter is
 * single-shot (one attempt per user click); if the bunker is unresponsive the
 * user sees the explicit awaiting-signer banner and an explicit "Reconnect
 * signer" button. This matches Ditto's behaviour and stops the periodic-retry
 * storm we used to fire while awaiting signer approval.
 */

import { useEffect } from "react";

import { pendingPublish } from "../state/pending-publish.client";

export function useComposerSignerReconnect(
  clearSigningState: () => void,
  isSigning: boolean,
  /** Legacy retry callback. When provided, runs after `pendingPublish.maybeResume`; return true if a retry was started (skip clearSigningState). */
  onHealthyWhileSigning?: () => boolean
): void {
  useEffect(() => {
    const handler = () => {
      // 1. Pending-publish store takes precedence whenever it has an
      //    awaiting attempt inside its recovery window.
      if (pendingPublish.maybeResume()) return;
      // 2. If the store still owns an in-flight attempt that hasn't reached
      //    `awaiting_signer` yet (typically `signing` while the original
      //    30s timeout is still pending), the UI must stay parked. The
      //    in-flight sign will settle on its own and either submit
      //    successfully or transition the store to `awaiting_signer` /
      //    `failed`. Clearing the UI here is what previously caused the
      //    duplicate-publish bug after a stop-then-restart of the bunker.
      if (pendingPublish.isActiveAttempt()) return;
      // 3. Legacy ref-based retry path (kept for unmigrated surfaces).
      const retried = onHealthyWhileSigning?.() === true;
      if (retried) return;
      // 4. No active attempt and no legacy retry — clear any stuck local
      //    signing UI so the user isn't stranded on an awaiting banner
      //    after the bunker is healthy again.
      clearSigningState();
    };
    window.addEventListener("nostr-connection-healthy", handler);
    return () =>
      window.removeEventListener("nostr-connection-healthy", handler);
    // `isSigning` is intentionally unused at runtime here; we keep it in the
    // signature for backwards compatibility with the existing callers and so
    // future debugging code can dispatch on it without a contract churn.
  }, [clearSigningState, onHealthyWhileSigning]);
  // Mark `isSigning` as referenced so TS doesn't drop the unused-arg warning.
  void isSigning;
}
