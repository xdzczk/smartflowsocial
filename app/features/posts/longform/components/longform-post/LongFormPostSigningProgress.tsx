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
        <div className="bg-section/45 text-text-secondary ring-border-subtle/40 dark:bg-section/30 flex items-center justify-between gap-2 rounded-lg p-3 text-sm ring-1">
          <span>
            Waiting for signer approval…
            {phaseStatus ? <> {phaseStatus}</> : null}
            {showRecovery
              ? " - Open your remote signer to approve. If your session expired, reconnect from Settings."
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
        <div className="bg-danger/[0.07] text-danger dark:bg-danger/[0.11] dark:text-danger ring-danger/25 dark:ring-danger/35 rounded-lg py-2.5 pl-3 text-[13px] ring-1">
          {signingError}
        </div>
      ) : null}
    </>
  );
}
