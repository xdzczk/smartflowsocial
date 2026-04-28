import { Loader2 } from "lucide-react";

export interface BulkPostsSubmitButtonProps {
  isSubmitting: boolean;
  isProcessing: boolean;
  isPreviewSubmitting: boolean;
  postsCount: number;
  preparationProgress?: {
    current: number;
    total: number;
    stage: string;
  };
  validationInvalid?: boolean;
}

export function BulkPostsSubmitButton({
  isSubmitting,
  isProcessing,
  isPreviewSubmitting,
  postsCount,
  preparationProgress,
  validationInvalid,
}: BulkPostsSubmitButtonProps) {
  const disabled =
    isSubmitting ||
    isProcessing ||
    isPreviewSubmitting ||
    (validationInvalid ?? false);
  const showProgress =
    isPreviewSubmitting &&
    preparationProgress !== undefined &&
    preparationProgress.total > 0;

  const getButtonContent = () => {
    if (isPreviewSubmitting) {
      return (
        <div className="flex w-full flex-col items-center gap-2">
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            {preparationProgress?.stage ?? "Validating & Preparing..."}
          </span>
          {showProgress ? (
            <div className="w-full">
              <div className="text-action-primary-foreground/80 mb-1 text-xs">
                Step {preparationProgress.current} of{" "}
                {preparationProgress.total}
              </div>
              <div className="bg-canvas/20 h-2 w-full rounded-full">
                <div
                  className="bg-canvas h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (preparationProgress.current /
                        preparationProgress.total) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      );
    }
    if (isSubmitting) {
      return (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Uploading Media Files...
        </span>
      );
    }
    if (isProcessing) {
      return "Processing Media Files...";
    }
    return `Preview ${postsCount} Post${postsCount !== 1 ? "s" : ""}`;
  };

  return (
    <button
      type="submit"
      disabled={disabled}
      className="bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 mt-6 w-full min-w-0 flex-1 rounded-lg p-4 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0"
    >
      {getButtonContent()}
    </button>
  );
}
