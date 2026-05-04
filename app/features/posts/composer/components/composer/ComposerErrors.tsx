/**
 * Composer error and status UI: signing wait banner, signing error alert.
 */

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { cancelSignerInFlight } from "~/features/auth/signer";
import {
  describeSignerPhase,
  shouldShowManualRecovery,
  useSignAttemptProgress,
} from "~/lib/hooks/useSignAttemptProgress";

export interface ComposerErrorsProps {
  /** Show "Waiting for signer approval" banner */
  isSigning: boolean;
  signerLabel: string | null;
  onCancelSigning: () => void;
  /** Signing error message; when set, show destructive alert with Try again */
  signingError: string | null;
  onDismissSigningError: () => void;
  onRetry: () => void;
  disabled?: boolean;
  signerReady?: boolean | null;
  /** Compact rail presentation (no outer margins, tighter copy/spacing). */
  inRail?: boolean;
}

export function ComposerErrors({
  isSigning,
  signerLabel,
  onCancelSigning,
  signingError,
  onDismissSigningError,
  onRetry,
  disabled = false,
  signerReady = null,
  inRail = false,
}: ComposerErrorsProps) {
  const { signAttempt, signElapsedSeconds } = useSignAttemptProgress(isSigning);
  const phaseStatus = describeSignerPhase(
    signAttempt?.phase,
    signElapsedSeconds,
    signAttempt?.timeoutMs
  );
  // Only point users at Settings → Reconnect once we've actually had to
  // reconnect or have failed. Pre-reconnect the auto-recovery layer almost
  // always succeeds within ~2 s, so showing recovery copy up-front trains
  // users to abort and reconnect instead of just approving in the bunker app.
  const showRecovery = shouldShowManualRecovery(signAttempt?.phase);
  const waitingCopy =
    signerLabel === "NIP-07 extension"
      ? "Approve this request in your browser extension."
      : showRecovery
        ? "Open your remote signer to approve. If your session expired, reconnect from Settings."
        : "Approve this request in your remote signer.";

  return (
    <>
      {isSigning ? (
        <div
          className={
            inRail
              ? "bg-surface-hover/60 text-text-secondary flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs"
              : "bg-surface-hover/50 text-text-secondary mb-3 flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
          }
        >
          <span>
            {inRail
              ? "Signer approval required."
              : "Waiting for signer approval…"}
            {phaseStatus ? <> {phaseStatus}</> : null}
            {" - "}
            {waitingCopy}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-text-secondary hover:text-text shrink-0"
            onClick={() => {
              onCancelSigning();
              cancelSignerInFlight();
            }}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {signingError ? (
        <Alert
          variant="destructive"
          className={
            inRail
              ? "flex flex-row items-center justify-between gap-2 py-2.5"
              : "mb-3 flex flex-row items-center justify-between gap-2"
          }
        >
          <AlertDescription className="flex-1">{signingError}</AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              onDismissSigningError();
              if (disabled || signerReady === false) return;
              onRetry();
            }}
          >
            Try again
          </Button>
        </Alert>
      ) : null}
    </>
  );
}
