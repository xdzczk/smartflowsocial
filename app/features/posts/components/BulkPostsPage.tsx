import { useLoaderData } from "@remix-run/react";
import { useEffect, useMemo } from "react";

import { Button } from "~/components/ui/button";
import MediaModal from "~/components/ui/MediaModal";
import Toast from "~/components/ui/Toast";
import { DraftPickerModal } from "~/features/posts/drafts";
import { useBulkPostsPageState } from "~/features/posts/hooks/useBulkPostsPageState";
import {
  BulkPostsActionButtons,
  BulkPostsSchedulingPanel,
  BulkPostsTable,
  BulkPostsUploadArea,
  PostConfirmation,
  PublishResultModal,
} from "~/features/posts/ui";
import { useBulkPostEvents } from "~/features/posts/useBulkPostEvents";
import { useBulkPostsState } from "~/features/posts/useBulkPostsState";
import {
  extractLoaderData,
  type BulkPostsLoaderData,
} from "~/features/posts/utils/bulkposts-loader.utils";
import { getPostTypeFromPost } from "~/features/posts/utils/publish-result.utils";
import { useDeferredRouteLoaderData } from "~/lib/remix/deferred-route-loader-context";
import { isVideoFile } from "~/utils/media-helpers";

import { BulkPostsSubmitButton } from "./BulkPostsSubmitButton";

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

/* eslint-disable-next-line sonarjs/cognitive-complexity -- Page component with many features; splitting would fragment state */
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

  const { state, handlers } = useBulkPostsPageState({
    tags,
    queueTypes,
    hashTagPresets,
    mode,
    groupId,
    bulkDraftGroupPosts,
  });
  const {
    posts,
    setPosts,
    preparedEvents,
    setPreparedEvents,
    showConfirmation,
    setShowConfirmation,
    isProcessing,
    setIsProcessing,
    isPreviewSubmitting,
    setIsPreviewSubmitting,
    preparationProgress,
    setPreparationProgress,
    firstItemTimeManuallyChanged: _firstItemTimeManuallyChanged,
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
  const { prepareEvents, validatePostsForPreview } = useBulkPostEvents({
    posts,
    fetcher,
    user,
    tags,
    useHashtagPresets,
    selectedHashtags,
    setToast,
    setPreparedEvents,
    setShowConfirmation,
    setIsPreviewSubmitting,
    setIsProcessing,
    setPreparationProgress,
    scheduleRandomWindowMinutes: bulkScheduleRandomWindowMinutes,
  });

  const validationResult = useMemo(
    () => validatePostsForPreview(),
    [validatePostsForPreview]
  );

  const previewData = useMemo(() => {
    const data = new Map<
      number,
      Array<{ url: string; isVideo: boolean; file: File }>
    >();
    posts.forEach((post, index) => {
      const files = post.files;
      if (files.length > 0) {
        data.set(
          index,
          files.map((file) => {
            const url = URL.createObjectURL(file);
            const isVideo = isVideoFile(file);
            return { url, isVideo, file };
          })
        );
      }
    });
    return data;
  }, [posts]);

  // Cleanup object URLs when component unmounts or posts change
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

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{getPageTitle(mode)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {mode !== "repost" && mode !== "quote" ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlers.addEmptyRows(1)}
                disabled={isProcessing}
              >
                + Add 1 Post
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlers.addEmptyRows(5)}
                disabled={isProcessing}
              >
                + Add 5
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlers.addEmptyRows(10)}
                disabled={isProcessing}
              >
                + Add 10
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
        </div>
      </div>
      <DraftPickerModal
        open={bulkDraftPickerOpen}
        onClose={() => setBulkDraftPickerOpen(false)}
        type="bulk"
        onSelect={(id) => navigate(`/dashboard/bulkposts?groupId=${id}`)}
      />
      {!showConfirmation ? (
        <fetcher.Form
          onSubmit={(e) => {
            void prepareEvents(e);
          }}
          className="w-full"
          encType="multipart/form-data"
        >
          {mode !== "repost" && mode !== "quote" ? (
            <BulkPostsUploadArea
              isProcessing={isProcessing}
              processingProgress={processingProgress}
              onFileChange={handlers.handleFileChange}
              onFilesDropped={handlers.handleBulkFilesDropped}
              uploadProvider={uploadProvider}
            />
          ) : null}

          <BulkPostsActionButtons
            posts={posts}
            isProcessing={isProcessing}
            scheduleIntervals={scheduleIntervals}
            queueTypes={queueTypes}
            hashTagPresets={hashTagPresets}
            selectedHashtagPresetId={selectedHashtagPresetId}
            useHashtagPresets={useHashtagPresets}
            handleScheduleIntervalClick={handlers.handleScheduleIntervalClick}
            handleBulkQueueUpdate={(queueType) =>
              void handlers.handleBulkQueueUpdate(queueType)
            }
            handleHashtagPresetSelect={handlers.handleHashtagPresetSelect}
            setUseHashtagPresets={setUseHashtagPresets}
            handleBulkRecyclableToggle={handlers.handleBulkRecyclableToggle}
            onRepostAll={
              mode !== "repost" && mode !== "quote"
                ? handlers.handleRepostAll
                : undefined
            }
          />

          {posts.length > 0 && mode !== "repost" && mode !== "quote" ? (
            <BulkPostsSchedulingPanel
              posts={posts}
              setPosts={setPosts}
              scheduleIntervals={scheduleIntervals}
              userTimezone={user?.timezone ?? "UTC"}
              disabled={isProcessing}
              scheduleRandomWindowMinutes={bulkScheduleRandomWindowMinutes}
              onScheduleRandomWindowMinutesChange={
                setBulkScheduleRandomWindowMinutes
              }
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

          {posts.length > 0 ? (
            <>
              {mode !== "repost" && mode !== "quote" ? (
                <div className="border-border bg-muted/30 mb-4 rounded-lg border p-4">
                  <span className="text-muted-foreground mb-2 block text-sm font-medium">
                    Only repost if original gets (applies to all reposts)
                  </span>
                  <div className="flex flex-wrap items-center gap-3 gap-y-2">
                    {[
                      { key: "minReactions" as const, label: "Reactions" },
                      { key: "minZaps" as const, label: "Zaps" },
                      { key: "minComments" as const, label: "Comments" },
                      { key: "minReposts" as const, label: "Reposts" },
                      { key: "minSats" as const, label: "Sats" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <label
                          htmlFor={`bulk-repost-cond-${key}`}
                          className="text-muted-foreground text-xs whitespace-nowrap"
                        >
                          {label}
                        </label>
                        <input
                          id={`bulk-repost-cond-${key}`}
                          type="number"
                          min={0}
                          placeholder="—"
                          value={bulkRepostConditions?.[key] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const v =
                              raw.trim() === ""
                                ? undefined
                                : Math.max(0, parseInt(raw, 10) || 0);
                            setBulkRepostConditions((prev) => {
                              if (v === undefined) {
                                const next = prev ? { ...prev } : {};
                                delete next[key];
                                return Object.keys(next).length > 0
                                  ? next
                                  : null;
                              }
                              return { ...prev, [key]: v };
                            });
                          }}
                          className="border-border bg-background text-foreground w-20 rounded-md border px-2 py-1.5 text-sm"
                          aria-label={`Min ${label.toLowerCase()}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <BulkPostsTable
                posts={posts}
                queueTypes={queueTypes}
                previewData={previewData}
                handleCaptionChange={handlers.handleCaptionChange}
                handleDateChange={handlers.handleDateChange}
                handleIsRecyclableChange={handlers.handleIsRecyclableChange}
                handleRemovePost={handlers.handleRemovePost}
                handleQueueTypeChange={(index, value) =>
                  void handlers.handleQueueTypeChange(index, value)
                }
                handleMediaClick={handlers.handleMediaClick}
                validationErrorsByIndex={validationResult.byPost}
                onRowFileSelect={
                  mode !== "repost" && mode !== "quote"
                    ? (idx, file) =>
                        void handlers.handleRowFileSelect(idx, file)
                    : undefined
                }
                onRowFileRemove={
                  mode !== "repost" && mode !== "quote"
                    ? handlers.handleRowFileRemove
                    : undefined
                }
                onRepostSchedulesChange={
                  mode !== "repost" && mode !== "quote"
                    ? handlers.handleRepostSchedulesChange
                    : undefined
                }
                onQuoteSchedulesChange={
                  mode !== "repost" && mode !== "quote"
                    ? handlers.handleQuoteSchedulesChange
                    : undefined
                }
                showAlsoSchedule={Boolean(
                  mode !== "repost" && mode !== "quote"
                )}
                userTimezone={user?.timezone ?? "UTC"}
              />

              {validationResult.isValid === false ? (
                <div
                  className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200"
                  role="alert"
                >
                  <p className="font-medium">
                    Fix the following before preview:
                  </p>
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
                  type="button"
                  variant="outline"
                  disabled={
                    posts.length === 0 ||
                    isSubmitting ||
                    isProcessing ||
                    isPreviewSubmitting
                  }
                  onClick={() => handlers.handleSaveDraftFromTable(groupId)}
                  className="w-full sm:w-auto"
                >
                  Save as draft
                </Button>
                <BulkPostsSubmitButton
                  isSubmitting={isSubmitting}
                  isProcessing={isProcessing}
                  isPreviewSubmitting={isPreviewSubmitting}
                  postsCount={posts.length}
                  preparationProgress={preparationProgress}
                  validationInvalid={!validationResult.isValid}
                />
              </div>
            </>
          ) : null}
        </fetcher.Form>
      ) : (
        <PostConfirmation
          preparedEvents={preparedEvents}
          posts={posts}
          postsCount={posts.length}
          groupId={groupId}
          userTimezone={user?.timezone ?? "UTC"}
          userTimeFormat={user?.timeFormat === "24h" ? "24h" : "12h"}
          repostConditions={bulkRepostConditions}
        />
      )}

      {/* Toast Notification */}
      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}

      {/* Media Modal */}
      {selectedMedia ? (
        <MediaModal
          src={selectedMedia}
          alt="Media content"
          isOpen={isMediaModalOpen}
          onClose={handlers.handleCloseMediaModal}
        />
      ) : null}

      {/* Bulk Scheduling Success Modal */}
      {showPublishModal && modalPostId && (modalPost || modalLongFormPost) ? (
        <PublishResultModal
          isOpen={showPublishModal}
          postId={modalPostId}
          publishAttemptId={null} // Scheduled posts don't have publishAttemptId yet
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
            // Reset form state and navigate to fresh bulk post page
            setPosts([]);
            setPreparedEvents([]);
            setShowConfirmation(false);
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
    </div>
  );
}
