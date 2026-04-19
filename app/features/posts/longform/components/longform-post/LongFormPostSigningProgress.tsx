import { Button } from "~/components/ui/button";
import { requestNewSignerSession } from "~/features/auth/signer";
import {
  describeSignerPhase,
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
  return (
    <>
      {isSigning ? (
        <div className="bg-muted/30 text-muted-foreground flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <span>
            Waiting for signer approval…
            {phaseStatus ? <> {phaseStatus}</> : null}
            {" — "}
            If you’re using a remote signer, open it to approve the request. To
            use a new session in the signer app, click &quot;Use new
            session&quot;.
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => void requestNewSignerSession(cancelSigning)}
            >
              Use new session
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={cancelSigning}
            >
              Cancel
            </Button>
          </span>
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
