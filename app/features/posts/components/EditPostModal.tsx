import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

import { handleErrorSafely, logClientError } from "~/lib/error-handler.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  parseDateTimeLocal,
  toDate,
  fromDate,
  toUnixTimestamp,
} from "~/lib/temporal";

import { useEditPostModal } from "../hooks/useEditPostModal";
import type {
  PostData,
  LongFormPostData,
  QueueType,
  HashTagPreset,
  UserData,
} from "../types";
import { prepareEditPostSubmission } from "../utils/editPostSubmit.client";
import {
  buildKind6RepostEvent,
  buildQuoteEvent,
} from "../utils/repost-quote-events.client";

import { EditLongFormFormFields } from "./EditLongFormFormFields";
import { EditorJSStyles } from "./EditorJSStyles";
import { EditPostFormFields } from "./EditPostFormFields";
interface EditPostModalProps {
  post: PostData | LongFormPostData;
  onClose: () => void;
  onConfirm: () => void;
  user?: UserData;
  queueTypes?: QueueType[];
  hashTagPresets?: HashTagPreset[];
}

interface FetcherData {
  success?: boolean;
  needsSigning?: boolean;
  error?: string;
}

export function EditPostModal({
  post,
  onClose,
  onConfirm,
  user,
  queueTypes = [],
  hashTagPresets = [],
}: EditPostModalProps) {
  const fetcher = useFetcher<FetcherData>();
  const scheduleRepostQuoteFetcher = useFetcher<{
    success?: boolean;
    error?: string;
  }>();
  const [isSigningEvent, setIsSigningEvent] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  // "Also schedule repost/quote" (only for regular posts)
  const [alsoScheduleRepost, setAlsoScheduleRepost] = useState(false);
  const [repostScheduledFor, setRepostScheduledFor] = useState("");
  const [alsoScheduleQuote, setAlsoScheduleQuote] = useState(false);
  const [quoteScheduledFor, setQuoteScheduledFor] = useState("");
  const [quoteCaption, setQuoteCaption] = useState("");

  // Determine if this is a longform post
  const isLongform = "title" in post;

  // Use custom hook for form state management
  const {
    caption,
    setCaption,
    selectedQueueType,
    setSelectedQueueType,
    title,
    setTitle,
    summary,
    setSummary,
    content,
    setContent: _setContent,
    image,
    setImage,
    scheduledFor,
    setScheduledFor,
    existingImages,
    newFiles,
    isUploadingImages,
    setIsUploadingImages,
    useHashtagPresets,
    setUseHashtagPresets,
    selectedHashtagPresetId,
    selectedHashtagPresetTags,
    manualHashtags,
    setManualHashtags,
    editorReady,
    handleFileChange,
    removeExistingImage,
    removeNewFile,
    handleHashtagPresetSelect,
    formatDateTimeForInput,
  } = useEditPostModal({
    post,
    user,
    hashTagPresets,
    isLongform,
  });

  useEffect(() => {
    const dataRaw = fetcher.data;
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as {
            success?: unknown;
            needsSigning?: unknown;
            error?: unknown;
          })
        : null;
    if (data && typeof data.success === "boolean" && data.success) {
      if (
        data.needsSigning &&
        typeof data.needsSigning === "boolean" &&
        data.needsSigning
      ) {
        return; // Keep modal open for re-signing
      }
      onConfirm();
    }
    if (data && "error" in data && typeof data.error === "string") {
      // Defer to avoid cascading renders
      setTimeout(() => {
        setSigningError(data.error as string);
      }, 0);
    }
  }, [fetcher.data, onConfirm]);

  useEffect(() => {
    if (
      scheduleRepostQuoteFetcher.state === "idle" &&
      scheduleRepostQuoteFetcher.data?.success
    ) {
      toast.success("Repost/quote scheduled successfully!");
    }
    if (scheduleRepostQuoteFetcher.data?.error) {
      toast.error(String(scheduleRepostQuoteFetcher.data.error));
    }
  }, [scheduleRepostQuoteFetcher.state, scheduleRepostQuoteFetcher.data]);

  const handleSubmit = async () => {
    try {
      setIsSigningEvent(true);
      setSigningError(null);
      setIsUploadingImages(true);

      const result = await prepareEditPostSubmission({
        post,
        isLongform,
        caption,
        title,
        summary,
        content,
        image,
        existingImages,
        newFiles,
        selectedHashtagPresetTags,
        manualHashtags,
        useHashtagPresets,
        selectedQueueType,
        selectedHashtagPresetId,
        scheduledFor,
        user,
      });

      const formData = "formData" in result ? result.formData : result;
      const mainSignedEvent =
        "signedEvent" in result && result.signedEvent
          ? result.signedEvent
          : null;

      // Signing complete; proceed to submit
      setIsSigningEvent(false);
      setIsUploadingImages(false);
      fetcher.submit(formData, { method: "post" });

      // If "also schedule repost/quote" and we have the re-signed event (regular post only)
      if (
        !isLongform &&
        mainSignedEvent &&
        (alsoScheduleRepost || alsoScheduleQuote)
      ) {
        const userTimezone = user?.timezone ?? "Etc/UTC";
        try {
          if (
            alsoScheduleRepost &&
            repostScheduledFor.trim() &&
            mainSignedEvent.id &&
            mainSignedEvent.pubkey
          ) {
            const zoned = parseDateTimeLocal(repostScheduledFor, userTimezone);
            const scheduledForUnix = toUnixTimestamp(zoned.withTimeZone("UTC"));
            const repostEvent = buildKind6RepostEvent(
              mainSignedEvent as {
                id: string;
                pubkey: string;
                created_at: number;
                kind: number;
                tags: string[][];
                content: string;
                sig: string;
              },
              scheduledForUnix
            );
            const { signedEvent: repostSignedEvent } =
              await nostrAdapter.signEvent({
                content: repostEvent.content,
                created_at: repostEvent.created_at,
                kind: repostEvent.kind,
                tags: repostEvent.tags,
              });
            const fd = new FormData();
            fd.set("_action", "scheduleRepost");
            fd.set("postId", post.id);
            fd.set("scheduledFor", scheduledForUnix.toString());
            fd.set("signedEvent", JSON.stringify(repostSignedEvent));
            scheduleRepostQuoteFetcher.submit(fd, {
              method: "post",
              action: "/dashboard/scheduled",
            });
          }
          if (
            alsoScheduleQuote &&
            quoteScheduledFor.trim() &&
            mainSignedEvent.id &&
            mainSignedEvent.pubkey
          ) {
            const zoned = parseDateTimeLocal(quoteScheduledFor, userTimezone);
            const scheduledForUnix = toUnixTimestamp(zoned.withTimeZone("UTC"));
            const quoteEvent = buildQuoteEvent(
              mainSignedEvent as {
                id: string;
                pubkey: string;
                created_at: number;
                kind: number;
                tags: string[][];
                content: string;
                sig: string;
              },
              quoteCaption,
              scheduledForUnix,
              []
            );
            const { signedEvent: quoteSignedEvent } =
              await nostrAdapter.signEvent({
                content: quoteEvent.content,
                created_at: quoteEvent.created_at,
                kind: quoteEvent.kind,
                tags: quoteEvent.tags,
              });
            const fd = new FormData();
            fd.set("_action", "scheduleQuote");
            fd.set("postId", post.id);
            fd.set("scheduledFor", scheduledForUnix.toString());
            fd.set("signedEvent", JSON.stringify(quoteSignedEvent));
            if (quoteCaption) {
              fd.set("quoteCaption", quoteCaption);
            }
            scheduleRepostQuoteFetcher.submit(fd, {
              method: "post",
              action: "/dashboard/scheduled",
            });
          }
        } catch (err) {
          handleErrorSafely(err, {
            component: "EditPostModal",
            action: "alsoScheduleRepostQuote",
          });
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to schedule repost/quote"
          );
        }
      }
    } catch (error: unknown) {
      logClientError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: "EditPostModal",
          action: "prepareEditPostSubmission",
          message: "Error re-signing event",
        }
      );
      setIsSigningEvent(false);
      setIsUploadingImages(false);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to sign event. Please try again.";
      setSigningError(errorMessage);
    }
  };

  return (
    <>
      {/* EditorJS Custom Styles */}
      {isLongform ? <EditorJSStyles /> : null}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg shadow-xl">
          <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-foreground text-xl font-semibold">
                Edit {isLongform ? "Article" : "Post"}
              </h3>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {isLongform ? (
                <EditLongFormFormFields
                  title={title}
                  setTitle={setTitle}
                  summary={summary}
                  setSummary={setSummary}
                  image={image}
                  setImage={setImage}
                  editorReady={editorReady}
                />
              ) : (
                <EditPostFormFields
                  caption={caption}
                  setCaption={setCaption}
                  existingImages={existingImages}
                  newFiles={newFiles}
                  onFileChange={(e) => void handleFileChange(e)}
                  onRemoveExistingImage={removeExistingImage}
                  onRemoveNewFile={removeNewFile}
                  hashTagPresets={hashTagPresets}
                  useHashtagPresets={useHashtagPresets}
                  setUseHashtagPresets={setUseHashtagPresets}
                  selectedHashtagPresetId={selectedHashtagPresetId}
                  selectedHashtagPresetTags={selectedHashtagPresetTags}
                  onHashtagPresetSelect={handleHashtagPresetSelect}
                  manualHashtags={manualHashtags}
                  setManualHashtags={setManualHashtags}
                  selectedQueueType={selectedQueueType}
                  setSelectedQueueType={setSelectedQueueType}
                  queueTypes={queueTypes}
                />
              )}

              {/* Schedule Date */}
              <div>
                <label
                  htmlFor="edit-post-scheduled-for"
                  className="text-muted-foreground mb-2 block text-sm font-medium"
                >
                  Scheduled For
                </label>
                <input
                  id="edit-post-scheduled-for"
                  type="datetime-local"
                  value={
                    scheduledFor ? formatDateTimeForInput(scheduledFor) : ""
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      try {
                        const userTimezone = user?.timezone ?? "UTC";
                        const zoned = parseDateTimeLocal(
                          e.target.value,
                          userTimezone
                        );
                        const utcZoned = zoned.withTimeZone("UTC");
                        setScheduledFor(toDate(utcZoned));
                      } catch {
                        // Fallback - still use Temporal for consistency
                        try {
                          const dateObj = new Date(e.target.value);
                          const userTimezone = user?.timezone ?? "UTC";
                          const zoned = fromDate(dateObj, userTimezone);
                          const utcZoned = zoned.withTimeZone("UTC");
                          setScheduledFor(toDate(utcZoned));
                        } catch {
                          // Ultimate fallback - only if Temporal completely fails
                          setScheduledFor(new Date(e.target.value));
                        }
                      }
                    } else {
                      setScheduledFor(null);
                    }
                  }}
                  className="bg-card border-border text-foreground focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 focus:ring-2"
                />
              </div>

              {/* Also schedule repost/quote - only for regular posts */}
              {!isLongform ? (
                <div className="border-border bg-muted/30 space-y-3 rounded-lg border p-4">
                  <div className="text-foreground text-sm font-medium">
                    Also schedule
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={alsoScheduleRepost}
                      onChange={(e) => setAlsoScheduleRepost(e.target.checked)}
                      className="border-border rounded"
                    />
                    <span className="text-sm">Schedule a repost</span>
                  </label>
                  {alsoScheduleRepost ? (
                    <div>
                      <label
                        htmlFor="edit-post-repost-scheduled-for"
                        className="text-muted-foreground mb-1 block text-xs"
                      >
                        Repost at
                      </label>
                      <input
                        id="edit-post-repost-scheduled-for"
                        type="datetime-local"
                        value={repostScheduledFor}
                        onChange={(e) => setRepostScheduledFor(e.target.value)}
                        className="bg-card border-border text-foreground w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </div>
                  ) : null}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={alsoScheduleQuote}
                      onChange={(e) => setAlsoScheduleQuote(e.target.checked)}
                      className="border-border rounded"
                    />
                    <span className="text-sm">Schedule a quote</span>
                  </label>
                  {alsoScheduleQuote ? (
                    <div className="space-y-1">
                      <div>
                        <label
                          htmlFor="edit-post-quote-scheduled-for"
                          className="text-muted-foreground mb-1 block text-xs"
                        >
                          Quote at
                        </label>
                        <input
                          id="edit-post-quote-scheduled-for"
                          type="datetime-local"
                          value={quoteScheduledFor}
                          onChange={(e) => setQuoteScheduledFor(e.target.value)}
                          className="bg-card border-border text-foreground w-full rounded-md border px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="edit-post-quote-caption"
                          className="text-muted-foreground mb-1 block text-xs"
                        >
                          Quote caption (optional)
                        </label>
                        <textarea
                          id="edit-post-quote-caption"
                          value={quoteCaption}
                          onChange={(e) => setQuoteCaption(e.target.value)}
                          placeholder="Add your comment..."
                          rows={2}
                          className="bg-card border-border text-foreground w-full rounded-md border px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Re-signing notice */}
              <div className="border-border bg-muted dark:border-border dark:bg-muted/20 rounded-lg border p-4">
                <div className="flex items-start space-x-2">
                  <svg
                    className="text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <div className="text-foreground text-sm font-medium">
                      Editing this {isLongform ? "article" : "post"} requires
                      re-signing the Nostr event
                    </div>
                  </div>
                </div>
              </div>
              {isSigningEvent ? (
                <div className="bg-muted text-muted-foreground rounded-lg border p-3 text-sm">
                  Waiting for signer approval… If you’re using a remote signer,
                  open it to approve the request.
                </div>
              ) : null}

              {/* Error display */}
              {(fetcher.data?.error ?? signingError) ? (
                <div className="border-destructive bg-destructive/10 dark:border-destructive dark:bg-destructive/20/20 rounded-lg border p-4">
                  <div className="text-destructive dark:text-destructive text-sm">
                    {fetcher.data?.error ?? signingError}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={
                  fetcher.state === "submitting" ||
                  isSigningEvent ||
                  isUploadingImages
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploadingImages
                  ? "Uploading Images..."
                  : isSigningEvent
                    ? "Signing Event..."
                    : fetcher.state === "submitting"
                      ? "Saving..."
                      : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
