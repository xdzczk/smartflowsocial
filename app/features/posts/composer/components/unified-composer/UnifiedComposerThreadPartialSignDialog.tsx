import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type PartialThreadState = {
  signedEvents: unknown[];
  failedIndices: number[];
} | null;

export function UnifiedComposerThreadPartialSignDialog({
  open,
  threadSegmentCount,
  partialThreadState,
  onOpenChange,
  onCancelSigning,
  onRetryThreadFailed,
  onSubmitThreadSuccessfulOnly,
}: {
  open: boolean;
  threadSegmentCount: number;
  partialThreadState: PartialThreadState;
  onOpenChange: (open: boolean) => void;
  onCancelSigning: () => void;
  onRetryThreadFailed: () => void;
  onSubmitThreadSuccessfulOnly: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Some thread segments could not be signed</DialogTitle>
          <DialogDescription>
            {partialThreadState
              ? `${partialThreadState.failedIndices.length} of ${threadSegmentCount} segments failed to sign after retry. You can schedule only the ${partialThreadState.signedEvents.length} successfully signed segments, or retry signing the failed ones.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onCancelSigning}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onRetryThreadFailed}
          >
            Retry failed signing
          </Button>
          <Button
            type="button"
            onClick={() => void onSubmitThreadSuccessfulOnly()}
            className="bg-success hover:bg-success/90 text-white"
          >
            Schedule {partialThreadState?.signedEvents.length ?? 0} segments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
