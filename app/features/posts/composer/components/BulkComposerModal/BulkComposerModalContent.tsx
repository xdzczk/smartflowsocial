/**
 * Bulk composer modal: same V2 layout as the page (canvas + settings rail).
 */

import type { FetcherWithComponents } from "@remix-run/react";
import { Hash, Loader2 } from "lucide-react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type {
  BulkBatchMode,
  BulkComposerStage,
} from "~/features/posts/bulk-composer/types";
import { BulkComposerPostCard } from "~/features/posts/components/bulk-composer/BulkComposerPostCard";
import { BulkComposerShell } from "~/features/posts/components/bulk-composer/BulkComposerShell";
import { BulkSettingsRail } from "~/features/posts/components/bulk-composer/BulkSettingsRail";
import { useBulkPostSigning } from "~/features/posts/hooks/useBulkPostSigning";
import {
  type BulkPost,
  type PreparedEvent,
  type QueueType,
} from "~/features/posts/server";
import type { RepostConditions } from "~/features/posts/types";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

import {
  isRepostOrQuote,
  type BulkComposerMode,
  type BulkComposerUser,
} from "../../utils/bulk-composer-modal.utils";

export interface BulkComposerModalContentProps {
  isLoadingContext: boolean;
  displayedHashtags: string | string[];
  bulkComposerStage: BulkComposerStage;
  setBulkComposerStage: (s: BulkComposerStage) => void;
  bulkBatchMode: BulkBatchMode;
  setBulkBatchMode: (m: BulkBatchMode) => void;
  focusPostIndex: number | null;
  setFocusPostIndex: (i: number | null) => void;
  processingProgress: { current: number; total: number };
  mode: BulkComposerMode;
  posts: BulkPost[];
  validationResult: {
    isValid: boolean;
    errors: string[];
    byPost: Record<number, string[]>;
  };
  preparationProgress: { current: number; total: number; stage: string };
  isProcessing: boolean;
  isSubmitting: boolean;
  isPreviewSubmitting: boolean;
  scheduleIntervals: number[] | undefined;
  queueTypes: QueueType[];
  hashTagPresets: Array<{ id: string; name: string; tags: string }>;
  selectedHashtagPresetId: string | null;
  useHashtagPresets: boolean;
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>;
  setUseHashtagPresets: (v: boolean) => void;
  submitAction: string;
  extraFormData: Record<string, string>;
  submitFetcher: FetcherWithComponents<unknown>;
  preparedEvents: PreparedEvent[];
  user: BulkComposerUser | null;
  previewData: Map<
    number,
    Array<{ url: string; isVideo: boolean; file: File }>
  >;
  handleScheduleIntervalClick: (interval: number) => void;
  handleBulkQueueUpdate: (queueType: string) => Promise<void>;
  handleHashtagPresetSelect: (
    presetId: string | null,
    hashtags: string
  ) => void;
  handleBulkRecyclableToggle: () => void;
  handleCaptionChange: (index: number, value: string) => void;
  handleDateChange: (index: number, value: string) => void;
  handleIsRecyclableChange: (index: number, checked: boolean) => void;
  handleRemovePost: (index: number) => void;
  handleQueueTypeChange: (index: number, value: string) => Promise<void>;
  handleIncludeHashtagsInNoteBodyChange: (
    index: number,
    checked: boolean
  ) => void;
  handleMediaClick: (mediaSrc: string) => void;
  handleRowFileSelect: (index: number, file: File | null) => Promise<void>;
  handleRowFileRemove: (index: number, mediaIndex: number) => void;
  repostConditions: RepostConditions | null;
  setRepostConditions: React.Dispatch<
    React.SetStateAction<RepostConditions | null>
  >;
  bulkScheduleRandomWindowMinutes: 0 | 5 | 10 | 15;
  setBulkScheduleRandomWindowMinutes: React.Dispatch<
    React.SetStateAction<0 | 5 | 10 | 15>
  >;
  rowMediaUploadDisabled?: boolean;
  startPrepareFlow: () => Promise<void>;
  duplicatePost: (index: number) => void;
  handleRepostSchedulesChange: (
    index: number,
    list: Array<{ value: number; unit: "hours" | "minutes" }>
  ) => void;
  handleQuoteSchedulesChange: (
    index: number,
    list: Array<{
      value: number;
      unit: "hours" | "minutes";
      caption?: string;
    }>
  ) => void;
  handleRepostAll: (delay: {
    value: number;
    unit: "hours" | "minutes";
  }) => void;
  handleSaveBulkDraft: () => void;
}

export function BulkComposerModalContent({
  isLoadingContext,
  displayedHashtags,
  bulkComposerStage,
  setBulkComposerStage,
  bulkBatchMode,
  setBulkBatchMode,
  focusPostIndex,
  setFocusPostIndex,
  processingProgress: _processingProgress,
  mode,
  posts,
  validationResult,
  preparationProgress,
  isProcessing,
  isSubmitting,
  isPreviewSubmitting,
  scheduleIntervals,
  queueTypes,
  hashTagPresets,
  selectedHashtagPresetId,
  useHashtagPresets,
  setPosts,
  setUseHashtagPresets,
  submitAction,
  extraFormData,
  submitFetcher,
  preparedEvents,
  user,
  previewData,
  handleScheduleIntervalClick,
  handleBulkQueueUpdate,
  handleHashtagPresetSelect,
  handleBulkRecyclableToggle,
  handleCaptionChange,
  handleDateChange,
  handleIsRecyclableChange,
  handleRemovePost,
  handleQueueTypeChange,
  handleIncludeHashtagsInNoteBodyChange,
  handleMediaClick,
  handleRowFileSelect,
  handleRowFileRemove,
  repostConditions,
  setRepostConditions,
  bulkScheduleRandomWindowMinutes,
  setBulkScheduleRandomWindowMinutes,
  rowMediaUploadDisabled = false,
  startPrepareFlow,
  duplicatePost,
  handleRepostSchedulesChange,
  handleQuoteSchedulesChange,
  handleRepostAll,
  handleSaveBulkDraft,
}: BulkComposerModalContentProps) {
  const showActions = !isRepostOrQuote(mode);
  const userTimezone = user?.timezone ?? "UTC";
  const userTimeFormat = user?.timeFormat === "24h" ? "24h" : "12h";

  const signing = useBulkPostSigning({
    preparedEvents,
    posts,
    groupId: null,
    submitAction,
    extraFormData,
    repostConditions,
    fetcher: submitFetcher as FetcherWithComponents<{ error?: string }>,
  });

  useEffect(() => {
    if (focusPostIndex === null || bulkComposerStage !== "build") return;
    const el = document.querySelector(
      `[data-bulk-post-index="${focusPostIndex}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFocusPostIndex(null);
  }, [focusPostIndex, bulkComposerStage, setFocusPostIndex]);

  const jumpToPost = (index: number) => {
    setBulkComposerStage("build");
    setFocusPostIndex(index);
  };

  if (isLoadingContext) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-text-secondary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {displayedHashtags && String(displayedHashtags).length <= 80 ? (
        <div className="bg-surface-hover text-text inline-cluster-tight mb-3 rounded-xs px-2 py-1 text-xs leading-4 font-semibold">
          <Hash
            className="inline-block size-4 opacity-75"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          <span>{displayedHashtags}</span>
        </div>
      ) : null}

      <BulkComposerShell
        title=""
        headerActions={null}
        railStickyShell={false}
        workspace={
          <>
            <Dialog
              open={signing.partialSignState !== null}
              onOpenChange={(open) => {
                if (!open) signing.setPartialSignState(null);
              }}
            >
              <DialogContent className="sm:max-w-md" hideCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>Some posts could not be signed</DialogTitle>
                  <DialogDescription>
                    {signing.partialSignState
                      ? `${signing.partialSignState.failedIndices.length} of ${preparedEvents.length} failed after retry.`
                      : ""}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => signing.setPartialSignState(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void signing.handleRetryFailedSigning()}
                  >
                    Retry failed
                  </Button>
                  <Button
                    type="button"
                    onClick={signing.handleScheduleSuccessfulOnly}
                  >
                    Schedule{" "}
                    {signing.partialSignState?.signedEntries.length ?? 0}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div
              className={
                bulkComposerStage === "review" ? "space-y-2" : "space-y-3"
              }
            >
              {posts.map((post, index) => (
                <BulkComposerPostCard
                  key={post.clientId}
                  index={index}
                  post={post}
                  variant={bulkComposerStage === "review" ? "review" : "build"}
                  queueTypes={queueTypes}
                  previewData={previewData}
                  preparedEvent={preparedEvents[index]}
                  validationErrors={validationResult.byPost[index]}
                  userTimezone={userTimezone}
                  userTimeFormat={userTimeFormat}
                  showAlsoSchedule={showActions}
                  rowMediaUploadDisabled={rowMediaUploadDisabled}
                  onCaptionChange={handleCaptionChange}
                  onDateChange={handleDateChange}
                  onQueueTypeChange={(i, v) => {
                    void handleQueueTypeChange(i, v);
                  }}
                  onIsRecyclableChange={handleIsRecyclableChange}
                  onRemove={handleRemovePost}
                  onDuplicate={duplicatePost}
                  onIncludeHashtagsInNoteBodyChange={
                    handleIncludeHashtagsInNoteBodyChange
                  }
                  onMediaClick={handleMediaClick}
                  onRowFileSelect={
                    showActions ? handleRowFileSelect : undefined
                  }
                  onRowFileRemove={
                    showActions ? handleRowFileRemove : undefined
                  }
                  onRepostSchedulesChange={
                    showActions ? handleRepostSchedulesChange : undefined
                  }
                  onQuoteSchedulesChange={
                    showActions ? handleQuoteSchedulesChange : undefined
                  }
                  onEditFromReview={(i) => jumpToPost(i)}
                  bulkRepostConditions={repostConditions}
                  showBatchRepostConditions={showActions}
                />
              ))}
            </div>
          </>
        }
        rail={
          <BulkSettingsRail
            shellOwnsRailSticky={false}
            stage={bulkComposerStage}
            batchMode={bulkBatchMode}
            onBatchModeChange={setBulkBatchMode}
            posts={posts}
            setPosts={setPosts}
            queueTypes={queueTypes}
            hashTagPresets={hashTagPresets}
            selectedHashtagPresetId={selectedHashtagPresetId}
            useHashtagPresets={useHashtagPresets}
            setUseHashtagPresets={setUseHashtagPresets}
            scheduleIntervals={scheduleIntervals}
            userTimezone={userTimezone}
            userTimeFormat={userTimeFormat}
            isProcessing={isProcessing}
            bulkScheduleRandomWindowMinutes={bulkScheduleRandomWindowMinutes}
            setBulkScheduleRandomWindowMinutes={
              setBulkScheduleRandomWindowMinutes
            }
            bulkRepostConditions={repostConditions}
            setBulkRepostConditions={setRepostConditions}
            showRepostConditions={showActions}
            validationResult={validationResult}
            onJumpToPost={jumpToPost}
            handleScheduleIntervalClick={handleScheduleIntervalClick}
            handleBulkQueueUpdate={(qt) => {
              void handleBulkQueueUpdate(qt);
            }}
            handleHashtagPresetSelect={handleHashtagPresetSelect}
            handleBulkRecyclableToggle={handleBulkRecyclableToggle}
            onRepostAll={showActions ? handleRepostAll : undefined}
            onSaveDraft={handleSaveBulkDraft}
            onReview={() => void startPrepareFlow()}
            onBackToEdit={() => setBulkComposerStage("build")}
            onSign={() => void signing.handleSignAndSubmit()}
            onSaveDraftReview={signing.handleSaveAsDraft}
            isSubmitting={isSubmitting}
            isPreviewSubmitting={isPreviewSubmitting}
            preparationProgress={preparationProgress}
            postsCount={posts.length}
            isSigning={signing.isSigning}
            signingProgress={signing.signingProgress}
            signingError={signing.signingError ?? signing.actionError}
            onCancelSigning={signing.cancelSigningState}
          />
        }
      />
    </>
  );
}
