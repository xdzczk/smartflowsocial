import { useLoaderData, type FetcherWithComponents } from "@remix-run/react";
import { useEffect, useMemo } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import MediaModal from "~/components/ui/MediaModal";
import Toast from "~/components/ui/Toast";
import { DraftPickerModal } from "~/features/posts/drafts";
import { useBulkPostSigning } from "~/features/posts/hooks/useBulkPostSigning";
import { useBulkPostsPageState } from "~/features/posts/hooks/useBulkPostsPageState";
import { PublishResultModal } from "~/features/posts/ui";
import { useBulkPostEvents } from "~/features/posts/useBulkPostEvents";
import { useBulkPostsState } from "~/features/posts/useBulkPostsState";
import {
  extractLoaderData,
  type BulkPostsLoaderData,
} from "~/features/posts/utils/bulkposts-loader.utils";
import { getPostTypeFromPost } from "~/features/posts/utils/publish-result.utils";
import { useBlossomUploadGate } from "~/features/upload";
import { useDeferredRouteLoaderData } from "~/lib/remix/deferred-route-loader-context";
import { isVideoFile } from "~/utils/media-helpers";

import { BulkComposerPostCard } from "./bulk-composer/BulkComposerPostCard";
import { BulkComposerShell } from "./bulk-composer/BulkComposerShell";
import { BulkSettingsRail } from "./bulk-composer/BulkSettingsRail";
import BulkPostsUploadArea from "./BulkPostsUploadArea";

function getPageTitle(mode: string | null): string {
  if (mode === "recycle") {
    return "Recycle & Schedule Posts";
  }
  if (mode === "repost") {
    return "Schedule Reposts (Kind 6)";
  }
  if (mode === "quote") {
    return "Schedule Quote Posts";
  }
  return "Bulk Schedule Posts";
}

export default function BulkPostsPage() {
  const deferredData = useDeferredRouteLoaderData();
  const loaderData = useLoaderData();
  const data = deferredData ?? loaderData;
  const {
    tags,
    queueTypes,
    hashTagPresets,
    mode,
    groupId,
    bulkDraftGroupPosts,
  }: BulkPostsLoaderData = extractLoaderData(data);

  const { mediaUploadBlocked } = useBlossomUploadGate();

  const { state, handlers } = useBulkPostsPageState({
    tags,
    queueTypes,
    hashTagPresets,
    mode,
    groupId,
    blossomMediaUploadBlocked: mediaUploadBlocked,
    bulkDraftGroupPosts,
  });
  const {
    posts,
    setPosts,
    preparedEvents,
    setPreparedEvents,
    bulkComposerStage,
    setBulkComposerStage,
    bulkBatchMode,
    setBulkBatchMode,
    focusPostIndex,
    setFocusPostIndex,
    isProcessing,
    setIsProcessing,
    isPreviewSubmitting,
    setIsPreviewSubmitting,
    preparationProgress,
    setPreparationProgress,
    toast,
    setToast,
    selectedMedia,
    isMediaModalOpen,
    uploadProvider,
    useHashtagPresets,
    setUseHashtagPresets,
    selectedHashtagPresetId,
    selectedHashtags,
    showPublishModal,
    setShowPublishModal,
    modalPostId,
    setModalPostId,
    modalPost,
    setModalPost,
    modalLongFormPost,
    setModalLongFormPost,
    bulkPostCount,
    setBulkPostCount,
    bulkSuccessLastAt,
    setBulkSuccessLastAt,
    bulkSuccessQueueSummary,
    setBulkSuccessQueueSummary,
    bulkRepostConditions,
    setBulkRepostConditions,
    bulkDraftPickerOpen,
    setBulkDraftPickerOpen,
    bulkScheduleRandomWindowMinutes,
    setBulkScheduleRandomWindowMinutes,
    scheduleIntervals,
    user,
    fetcher,
    isSubmitting,
    navigate,
    processingProgress,
  } = state;

  useBulkPostsState({ mode, posts, setPosts });
  const { startPrepareFlow, validatePostsForPreview } = useBulkPostEvents({
    posts,
    fetcher,
    user,
    tags,
    useHashtagPresets,
    selectedHashtags,
    setToast,
    setPreparedEvents,
    setBulkComposerStage,
    setIsPreviewSubmitting,
    setIsProcessing,
    setPreparationProgress,
    scheduleRandomWindowMinutes: bulkScheduleRandomWindowMinutes,
  });

  const signing = useBulkPostSigning({
    preparedEvents,
    posts,
    groupId,
    repostConditions: bulkRepostConditions,
    fetcher: fetcher as FetcherWithComponents<{ error?: string }>,
  });

  const validationResult = useMemo(
    () => validatePostsForPreview(),
    [validatePostsForPreview]
  );

  const previewData = useMemo(() => {
    const map = new Map<
      number,
      Array<{ url: string; isVideo: boolean; file: File }>
    >();
    posts.forEach((post, index) => {
      const files = post.files;
      if (files.length > 0) {
        map.set(
          index,
          files.map((file) => {
            const url = URL.createObjectURL(file);
            const isVideo = isVideoFile(file);
            return { url, isVideo, file };
          })
        );
      }
    });
    return map;
  }, [posts]);

  useEffect(() => {
    return () => {
      previewData.forEach((arr) => {
        arr.forEach((item) => {
          if (typeof item.url === "string") {
            URL.revokeObjectURL(item.url);
          }
        });
      });
    };
  }, [previewData]);

  useEffect(() => {
    if (focusPostIndex === null || bulkComposerStage !== "build") return;
    const el = document.querySelector(
      `[data-bulk-post-index="${focusPostIndex}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFocusPostIndex(null);
  }, [focusPostIndex, bulkComposerStage, setFocusPostIndex]);

  const showActions = mode !== "repost" && mode !== "quote";
  const userTimezone = user?.timezone ?? "UTC";
  const userTimeFormat = user?.timeFormat === "24h" ? "24h" : "12h";

  const jumpToPost = (index: number) => {
    setBulkComposerStage("build");
    setFocusPostIndex(index);
  };

  const headerActions = (
    <>
      {showActions ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlers.addEmptyRows(1)}
            disabled={isProcessing}
          >
            Add 1 Post
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlers.addEmptyRows(5)}
            disabled={isProcessing}
          >
            Add 5
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlers.addEmptyRows(10)}
            disabled={isProcessing}
          >
            Add 10
          </Button>
        </>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setBulkDraftPickerOpen(true)}
      >
        Open draft
      </Button>
    </>
  );

  return (
    <>
      <BulkComposerShell
        title={getPageTitle(mode)}
        headerActions={headerActions}
        workspace={
          <>
            <DraftPickerModal
              open={bulkDraftPickerOpen}
              onClose={() => setBulkDraftPickerOpen(false)}
              type="bulk"
              onSelect={(id) => navigate(`/dashboard/bulkposts?groupId=${id}`)}
            />

            {bulkComposerStage === "build" && showActions ? (
              <BulkPostsUploadArea
                isProcessing={isProcessing}
                processingProgress={processingProgress}
                onFileChange={handlers.handleFileChange}
                onFilesDropped={handlers.handleBulkFilesDropped}
                uploadProvider={uploadProvider}
                mediaUploadBlocked={mediaUploadBlocked}
                postCount={posts.length}
              />
            ) : null}

            {(mode === "quote" || mode === "repost") && posts.length === 0 ? (
              <div className="border-border bg-muted/30 rounded-lg border p-6 text-center">
                <p className="text-foreground mb-2 font-medium">
                  No posts to schedule.
                </p>
                <p className="text-muted-foreground mb-4 text-sm">
                  Select regular posts (not articles) from Published and try
                  &quot;Schedule {mode === "quote" ? "quote" : "repost"}&quot;
                  again.
                </p>
                <a
                  href="/dashboard/published"
                  className="text-primary font-medium hover:underline"
                >
                  Go to Published
                </a>
              </div>
            ) : null}

            {signing.isSigning ? (
              <div className="bg-muted text-muted-foreground mb-3 flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Waiting for signer approval…
                  {signing.signAttempt ? (
                    <>
                      {" "}
                      Attempt {signing.signAttempt.attempt} of{" "}
                      {signing.signAttempt.maxAttempts} ·{" "}
                      {signing.formatAttemptElapsed(
                        signing.signElapsedSeconds,
                        signing.signAttempt.timeoutMs
                      )}
                    </>
                  ) : null}
                  {signing.signingProgress ? (
                    <span className="ml-1">
                      (post {signing.signingProgress.current}/
                      {signing.signingProgress.total})
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void signing.requestNewSignerSession(
                        signing.cancelSigningState
                      )
                    }
                  >
                    New session
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      signing.cancelSigningState();
                      void signing.tryBackgroundReconnect();
                    }}
                  >
                    Cancel
                  </Button>
                </span>
              </div>
            ) : null}

            {(signing.signingError ?? signing.actionError) &&
            bulkComposerStage === "review" ? (
              <div className="border-destructive bg-destructive/10 text-destructive mb-3 rounded-md border p-3 text-sm">
                {signing.signingError ?? signing.actionError}
              </div>
            ) : null}

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
                      ? `${signing.partialSignState.failedIndices.length} of ${preparedEvents.length} posts failed to sign after retry.`
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
                    {signing.partialSignState?.signedEntries.length ?? 0} posts
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div
              className={
                bulkComposerStage === "review"
                  ? "space-y-3 opacity-95"
                  : "space-y-4"
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
                  rowMediaUploadDisabled={mediaUploadBlocked}
                  onCaptionChange={handlers.handleCaptionChange}
                  onDateChange={handlers.handleDateChange}
                  onQueueTypeChange={(i, v) => {
                    void handlers.handleQueueTypeChange(i, v);
                  }}
                  onIsRecyclableChange={handlers.handleIsRecyclableChange}
                  onRemove={handlers.handleRemovePost}
                  onDuplicate={handlers.duplicatePost}
                  onIncludeHashtagsInNoteBodyChange={
                    handlers.handleIncludeHashtagsInNoteBodyChange
                  }
                  onMediaClick={handlers.handleMediaClick}
                  onRowFileSelect={
                    showActions ? handlers.handleRowFileSelect : undefined
                  }
                  onRowFileRemove={
                    showActions ? handlers.handleRowFileRemove : undefined
                  }
                  onRepostSchedulesChange={
                    showActions
                      ? handlers.handleRepostSchedulesChange
                      : undefined
                  }
                  onQuoteSchedulesChange={
                    showActions
                      ? handlers.handleQuoteSchedulesChange
                      : undefined
                  }
                  onEditFromReview={(i) => jumpToPost(i)}
                  bulkRepostConditions={bulkRepostConditions}
                  showBatchRepostConditions={showActions}
                />
              ))}
            </div>
          </>
        }
        rail={
          <BulkSettingsRail
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
            bulkRepostConditions={bulkRepostConditions}
            setBulkRepostConditions={setBulkRepostConditions}
            showRepostConditions={showActions}
            validationResult={validationResult}
            onJumpToPost={jumpToPost}
            handleScheduleIntervalClick={handlers.handleScheduleIntervalClick}
            handleBulkQueueUpdate={(qt) => {
              void handlers.handleBulkQueueUpdate(qt);
            }}
            handleHashtagPresetSelect={handlers.handleHashtagPresetSelect}
            handleBulkRecyclableToggle={handlers.handleBulkRecyclableToggle}
            onRepostAll={showActions ? handlers.handleRepostAll : undefined}
            onSaveDraft={() => handlers.handleSaveDraftFromTable(groupId)}
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
          />
        }
      />

      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}

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
          onCreateNew={() => {
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            setBulkPostCount(null);
            setBulkSuccessLastAt(null);
            setBulkSuccessQueueSummary(null);
            setPosts([]);
            setPreparedEvents([]);
            setBulkComposerStage("build");
            navigate(`/dashboard/bulkposts${mode ? `?mode=${mode}` : ""}`, {
              replace: true,
            });
          }}
          onViewPage={() => {
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            setBulkPostCount(null);
            setBulkSuccessLastAt(null);
            setBulkSuccessQueueSummary(null);
            navigate("/dashboard/scheduled");
          }}
          onGoToDashboard={() => {
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            setBulkPostCount(null);
            setBulkSuccessLastAt(null);
            setBulkSuccessQueueSummary(null);
            navigate("/dashboard");
          }}
        />
      ) : null}
    </>
  );
}
