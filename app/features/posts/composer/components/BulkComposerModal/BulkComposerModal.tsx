/**
 * In-page bulk composer as a modal for Published and Scheduled pages.
 * Thin shell: dialog + hook + content + toast/media/publish modals.
 */

import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import MediaModal from "~/components/ui/MediaModal";
import Toast from "~/components/ui/Toast";
import { PublishResultModal } from "~/features/posts/ui";
import { getPostTypeFromPost } from "~/features/posts/utils/publish-result.utils";

import { useBulkComposerModalState } from "../../hooks/useBulkComposerModalState";
import { getModalTitle } from "../../utils/bulk-composer-modal.utils";

import { BulkComposerModalContent } from "./BulkComposerModalContent";
import type { BulkComposerModalProps } from "./types";

export function BulkComposerModal({
  open,
  onClose,
  onSuccess,
  mode,
  initialPosts,
  user,
  queueTypes: queueTypesProp,
  hashTagPresets: hashTagPresetsProp,
  tags: tagsProp,
}: BulkComposerModalProps) {
  const { state, handlers, submitFetcher } = useBulkComposerModalState({
    open,
    initialPosts,
    mode,
    user,
    queueTypesProp,
    hashTagPresetsProp,
    tagsProp,
    onSuccess,
    onClose,
  });

  const {
    posts,
    displayedHashtags,
    bulkComposerStage,
    setBulkComposerStage,
    bulkBatchMode,
    setBulkBatchMode,
    focusPostIndex,
    setFocusPostIndex,
    processingProgress,
    preparationProgress,
    isProcessing,
    toast,
    selectedMedia,
    isMediaModalOpen,
    showPublishModal,
    modalPostId,
    modalPost,
    modalLongFormPost,
    bulkPostCount,
    bulkSuccessLastAt,
    bulkSuccessQueueSummary,
    ...restState
  } = state;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="flex max-h-[90dvh] max-w-4xl flex-col overflow-hidden p-0"
        hideCloseButton={false}
      >
        <DialogTitle className="sr-only">{getModalTitle(mode)}</DialogTitle>
        <div className="border-border flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">{getModalTitle(mode)}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <BulkComposerModalContent
            isLoadingContext={restState.isLoadingContext}
            displayedHashtags={displayedHashtags}
            bulkComposerStage={bulkComposerStage}
            setBulkComposerStage={setBulkComposerStage}
            bulkBatchMode={bulkBatchMode}
            setBulkBatchMode={setBulkBatchMode}
            focusPostIndex={focusPostIndex}
            setFocusPostIndex={setFocusPostIndex}
            processingProgress={processingProgress}
            mode={mode}
            posts={posts}
            validationResult={restState.validationResult}
            preparationProgress={preparationProgress}
            isProcessing={isProcessing}
            isSubmitting={restState.isSubmitting}
            isPreviewSubmitting={restState.isPreviewSubmitting}
            scheduleIntervals={restState.scheduleIntervals}
            queueTypes={restState.queueTypes}
            hashTagPresets={restState.hashTagPresets}
            selectedHashtagPresetId={restState.selectedHashtagPresetId}
            useHashtagPresets={restState.useHashtagPresets}
            setPosts={restState.setPosts}
            setUseHashtagPresets={restState.setUseHashtagPresets}
            submitAction={restState.submitAction}
            extraFormData={restState.extraFormData}
            submitFetcher={submitFetcher}
            preparedEvents={restState.preparedEvents}
            user={user}
            previewData={restState.previewData}
            handleScheduleIntervalClick={handlers.handleScheduleIntervalClick}
            handleBulkQueueUpdate={handlers.handleBulkQueueUpdate}
            handleHashtagPresetSelect={handlers.handleHashtagPresetSelect}
            handleBulkRecyclableToggle={handlers.handleBulkRecyclableToggle}
            handleCaptionChange={handlers.handleCaptionChange}
            handleDateChange={handlers.handleDateChange}
            handleIsRecyclableChange={handlers.handleIsRecyclableChange}
            handleRemovePost={handlers.handleRemovePost}
            handleQueueTypeChange={handlers.handleQueueTypeChange}
            handleIncludeHashtagsInNoteBodyChange={
              handlers.handleIncludeHashtagsInNoteBodyChange
            }
            handleMediaClick={handlers.handleMediaClick}
            handleRowFileSelect={handlers.handleRowFileSelect}
            handleRowFileRemove={handlers.handleRowFileRemove}
            repostConditions={restState.repostConditions}
            setRepostConditions={restState.setRepostConditions}
            bulkScheduleRandomWindowMinutes={
              restState.bulkScheduleRandomWindowMinutes
            }
            setBulkScheduleRandomWindowMinutes={
              restState.setBulkScheduleRandomWindowMinutes
            }
            rowMediaUploadDisabled={restState.blossomMediaUploadBlocked}
            startPrepareFlow={handlers.startPrepareFlow}
            duplicatePost={handlers.duplicatePost}
            handleReorderBulkPost={handlers.handleReorderBulkPost}
            handleRepostSchedulesChange={handlers.handleRepostSchedulesChange}
            handleQuoteSchedulesChange={handlers.handleQuoteSchedulesChange}
            handleRepostAll={handlers.handleRepostAll}
            handleSaveBulkDraft={handlers.handleSaveBulkDraft}
          />
        </div>

        {toast ? (
          <div className="flex-shrink-0 p-4 pt-0">
            <Toast toast={toast} onClose={() => state.setToast(null)} />
          </div>
        ) : null}

        {selectedMedia ? (
          <MediaModal
            src={selectedMedia}
            alt="Media content"
            isOpen={isMediaModalOpen}
            onClose={handlers.handleCloseMediaModal}
          />
        ) : null}

        {showPublishModal && modalPostId && (modalPost || modalLongFormPost) ? (
          <PublishResultModal
            isOpen={showPublishModal}
            postId={modalPostId}
            publishAttemptId={null}
            action="schedule"
            postType={getPostTypeFromPost(modalPost, modalLongFormPost)}
            scheduledFor={
              modalPost?.scheduledAtUtc ??
              modalLongFormPost?.scheduledAtUtc ??
              null
            }
            bulkCount={bulkPostCount}
            lastScheduledAt={bulkSuccessLastAt}
            queueSummary={bulkSuccessQueueSummary ?? undefined}
            onCreateNew={handlers.handleSuccessClose}
            onViewPage={handlers.handleSuccessClose}
            onGoToDashboard={handlers.handleSuccessClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
