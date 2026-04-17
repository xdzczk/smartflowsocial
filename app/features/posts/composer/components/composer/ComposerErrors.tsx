/**
 * Composer error and status UI: signing wait banner, signing error alert.
 */

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  requestNewSignerSession,
  tryBackgroundReconnect,
} from "~/features/auth/signer";
import {
  formatAttemptElapsed,
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
  const waitingCopy =
    signerLabel === "NIP-07 extension"
      ? "Approve this request in your browser extension."
      : inRail
        ? "Approve this request in your remote signer. If you started a fresh session, use New session."
        : 'If you\'re using a remote signer, open it to approve the request. If you started a new session in the signer app, click "Use new session" below.';

  return (
    <>
      {isSigning ? (
        <div
          className={
            inRail
              ? "bg-muted/35 text-muted-foreground flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs"
              : "bg-muted/30 text-muted-foreground mb-3 flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
          }
        >
          <span>
            {inRail
              ? "Signer approval required."
              : "Waiting for signer approval…"}
            {signAttempt ? (
              <>
                {" "}
                Attempt {signAttempt.attempt} of {signAttempt.maxAttempts} ·{" "}
                {formatAttemptElapsed(
                  signElapsedSeconds,
                  signAttempt.timeoutMs
                )}
              </>
            ) : null}
            {" — "}
            {waitingCopy}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {signerLabel !== "NIP-07 extension" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => void requestNewSignerSession(onCancelSigning)}
              >
                New session
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                onCancelSigning();
                void tryBackgroundReconnect();
              }}
            >
              Cancel
            </Button>
          </span>
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
