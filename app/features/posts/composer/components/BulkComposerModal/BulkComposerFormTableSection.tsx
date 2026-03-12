/**
 * Form table section for the bulk composer modal (table + validation + preview button).
 */

import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { type BulkPost, type QueueType } from "~/features/posts/server";
import { BulkPostsTable } from "~/features/posts/ui";

export interface BulkComposerFormTableSectionProps {
  posts: BulkPost[];
  validationResult: {
    isValid: boolean;
    errors: string[];
    byPost: Record<number, string[]>;
  };
  preparationProgress: { current: number; total: number; stage: string };
  isSubmitting: boolean;
  isProcessing: boolean;
  isPreviewSubmitting: boolean;
  queueTypes: QueueType[];
  previewData: Map<
    number,
    Array<{ url: string; isVideo: boolean; file: File }>
  >;
  showActions: boolean;
  userTimezone: string;
  handleCaptionChange: (index: number, value: string) => void;
  handleDateChange: (index: number, value: string) => void;
  handleIsRecyclableChange: (index: number, checked: boolean) => void;
  handleRemovePost: (index: number) => void;
  handleQueueTypeChange: (index: number, value: string) => Promise<void>;
  handleMediaClick: (mediaSrc: string) => void;
  handleRowFileSelect: (index: number, file: File | null) => Promise<void>;
  handleRowFileRemove: (index: number, mediaIndex: number) => void;
}

export function BulkComposerFormTableSection({
  posts,
  validationResult,
  preparationProgress,
  isSubmitting,
  isProcessing,
  isPreviewSubmitting,
  queueTypes,
  previewData,
  showActions,
  userTimezone,
  handleCaptionChange,
  handleDateChange,
  handleIsRecyclableChange,
  handleRemovePost,
  handleQueueTypeChange,
  handleMediaClick,
  handleRowFileSelect,
  handleRowFileRemove,
}: BulkComposerFormTableSectionProps) {
  return (
    <>
      <BulkPostsTable
        posts={posts}
        queueTypes={queueTypes}
        previewData={previewData}
        handleCaptionChange={handleCaptionChange}
        handleDateChange={handleDateChange}
        handleIsRecyclableChange={handleIsRecyclableChange}
        handleRemovePost={handleRemovePost}
        handleQueueTypeChange={(idx, value) => {
          void handleQueueTypeChange(idx, value);
        }}
        handleMediaClick={handleMediaClick}
        validationErrorsByIndex={validationResult.byPost}
        onRowFileSelect={
          showActions
            ? (idx, file) => {
                void handleRowFileSelect(idx, file);
              }
            : undefined
        }
        onRowFileRemove={showActions ? handleRowFileRemove : undefined}
        onRepostSchedulesChange={undefined}
        onQuoteSchedulesChange={undefined}
        showAlsoSchedule={showActions}
        userTimezone={userTimezone}
      />
      {!validationResult.isValid ? (
        <div
          className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200"
          role="alert"
        >
          <p className="font-medium">Fix the following before preview:</p>
          <ul className="mt-1 list-inside list-disc">
            {validationResult.errors.slice(0, 5).map((err) => (
              <li key={err}>{err}</li>
            ))}
            {validationResult.errors.length > 5 ? (
              <li>… and {validationResult.errors.length - 5} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="submit"
          disabled={
            posts.length === 0 ||
            isSubmitting ||
            isProcessing ||
            isPreviewSubmitting ||
            !validationResult.isValid
          }
          className="w-full sm:w-auto"
        >
          {isPreviewSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {preparationProgress.stage || "Preparing..."}
            </span>
          ) : (
            `Preview ${posts.length} Post${posts.length !== 1 ? "s" : ""}`
          )}
        </Button>
      </div>
    </>
  );
}
