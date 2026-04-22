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
        <div className="bg-surface-hover/30 text-text-secondary flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
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
            className="text-text-secondary hover:text-text shrink-0"
            onClick={cancelSigning}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {signingError ? (
        <div className="border-danger bg-danger/10 text-danger dark:border-danger/60 dark:bg-danger/10 dark:text-danger rounded-md border p-3 text-sm">
          {signingError}
        </div>
      ) : null}
    </>
  );
}
