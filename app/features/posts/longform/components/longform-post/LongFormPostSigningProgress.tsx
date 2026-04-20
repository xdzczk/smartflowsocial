import { Button } from "~/components/ui/button";
import {
  describeSignerPhase,
  shouldShowManualRecovery,
  type SignAttemptProgress,
} from "~/lib/hooks/useSignAttemptProgress";

interface LongFormPostSigningProgressProps {
  isSigning: boolean;
  signingError: string | null;
  signAttempt: SignAttemptProgress | null;
  signElapsedSeconds: number;
  cancelSigning: () => void;
}

export function LongFormPostSigningProgress({
  isSigning,
  signingError,
  signAttempt,
  signElapsedSeconds,
  cancelSigning,
}: LongFormPostSigningProgressProps) {
  const phaseStatus = describeSignerPhase(
    signAttempt?.phase,
    signElapsedSeconds,
    signAttempt?.timeoutMs
  );
  const showRecovery = shouldShowManualRecovery(signAttempt?.phase);
  return (
    <>
      {isSigning ? (
        <div className="bg-muted/30 text-muted-foreground flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <span>
            Waiting for signer approval…
            {phaseStatus ? <> {phaseStatus}</> : null}
            {showRecovery
              ? " — Open your remote signer to approve. If your session expired, reconnect from Settings."
              : null}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground shrink-0"
            onClick={cancelSigning}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {signingError ? (
        <div className="border-destructive bg-destructive/10 text-destructive dark:border-destructive/60 dark:bg-destructive/10 dark:text-destructive rounded-md border p-3 text-sm">
          {signingError}
        </div>
      ) : null}
    </>
  );
}
