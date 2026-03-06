import { useFetcher } from "@remix-run/react";
import { Info, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  handleErrorSafely,
  logClientError,
  getClientDisplayErrorMessage,
  showErrorToastFromUnknown,
} from "~/lib/error-handler.client";
import {
  formatAttemptElapsed,
  useSignAttemptProgress,
} from "~/lib/hooks/useSignAttemptProgress";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { tryBackgroundReconnect } from "~/lib/nostr-signer-manager.client";
import {
  fromDate,
  getNowForDateTimeLocal,
  parseDateTimeLocal,
  toDate,
} from "~/lib/temporal";

import { useEditPostModal } from "../hooks/useEditPostModal";
import type {
  PostData,
  LongFormPostData,
  QueueType,
  HashTagPreset,
  UserData,
} from "../types";
import {
  delayAfterMainToSeconds,
  isValidDelayAfterMain,
  type DelayAfterMain,
} from "../utils/delay-after-main";
import { prepareEditPostSubmission } from "../utils/editPostSubmit.client";
import {
  buildKind6RepostEvent,
  buildQuoteEvent,
} from "../utils/repost-quote-events.client";

// eslint-disable-next-line import/order -- parent and sibling groups adjacent
import { EditLongFormFormFields } from "./EditLongFormFormFields";

interface MainEv {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

async function runScheduleRepostQuoteIfNeeded(
  isLongform: boolean,
  mainSignedEvent: unknown,
  formData: FormData,
  postId: string,
  repostDelayList: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
  }>,
  quoteEntries: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
    caption: string;
  }>,
  alsoScheduleRepost: boolean,
  alsoScheduleQuote: boolean
): Promise<void> {
  if (
    isLongform ||
    !mainSignedEvent ||
    (!alsoScheduleRepost && !alsoScheduleQuote)
  ) {
    return;
  }
  const mainScheduledForStr = formData.get("scheduledFor");
  const mainScheduledUnix =
    typeof mainScheduledForStr === "string"
      ? parseInt(mainScheduledForStr, 10)
      : NaN;
  const hasMainScheduled =
    !Number.isNaN(mainScheduledUnix) && mainScheduledUnix > 0;
  const mainEv = mainSignedEvent as MainEv;
  if (!hasMainScheduled || !mainEv.id || !mainEv.pubkey) return;
  try {
    await scheduleRepostsAndQuotesAfterSubmit(
      mainScheduledUnix,
      mainEv,
      postId,
      repostDelayList,
      quoteEntries,
      alsoScheduleRepost,
      alsoScheduleQuote
    );
    if (
      (alsoScheduleRepost && repostDelayList.length > 0) ||
      (alsoScheduleQuote && quoteEntries.length > 0)
    ) {
      toast.success("Repost/quote scheduled successfully!");
    }
  } catch (err) {
    handleErrorSafely(err, {
      component: "EditPostModal",
      action: "alsoScheduleRepostQuote",
    });
    showErrorToastFromUnknown(err, {
      fallback: "Failed to schedule repost/quote",
    });
  }
}

async function scheduleRepostsAndQuotesAfterSubmit(
  mainScheduledUnix: number,
  mainEv: MainEv,
  postId: string,
  repostDelayList: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
  }>,
  quoteEntries: Array<{
    id: string;
    value: number;
    unit: DelayAfterMain["unit"];
    caption: string;
  }>,
  alsoScheduleRepost: boolean,
  alsoScheduleQuote: boolean
): Promise<void> {
  if (alsoScheduleRepost && repostDelayList.length > 0) {
    for (const item of repostDelayList) {
      const delay: DelayAfterMain = { value: item.value, unit: item.unit };
      if (!isValidDelayAfterMain(delay)) continue;
      const offsetSeconds = delayAfterMainToSeconds(delay);
      const repostScheduledForUnix = mainScheduledUnix + offsetSeconds;
      const repostEvent = buildKind6RepostEvent(mainEv, repostScheduledForUnix);
      const { signedEvent: repostSignedEvent } = await nostrAdapter.signEvent({
        content: repostEvent.content,
        created_at: repostEvent.created_at,
        kind: repostEvent.kind,
        tags: repostEvent.tags,
      });
      const fd = new FormData();
      fd.set("_action", "scheduleRepost");
      fd.set("postId", postId);
      fd.set("scheduledFor", repostScheduledForUnix.toString());
      fd.set("signedEvent", JSON.stringify(repostSignedEvent));
      const res = await fetch("/dashboard/scheduled", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Failed to schedule repost");
    }
  }
  if (alsoScheduleQuote && quoteEntries.length > 0) {
    for (const entry of quoteEntries) {
      const delay: DelayAfterMain = { value: entry.value, unit: entry.unit };
      if (!isValidDelayAfterMain(delay)) continue;
      const offsetSeconds = delayAfterMainToSeconds(delay);
      const quoteScheduledForUnix = mainScheduledUnix + offsetSeconds;
      const quoteEvent = buildQuoteEvent(
        mainEv,
        entry.caption,
        quoteScheduledForUnix,
        []
      );
      const { signedEvent: quoteSignedEvent } = await nostrAdapter.signEvent({
        content: quoteEvent.content,
        created_at: quoteEvent.created_at,
        kind: quoteEvent.kind,
        tags: quoteEvent.tags,
      });
      const fd = new FormData();
      fd.set("_action", "scheduleQuote");
      fd.set("postId", postId);
      fd.set("scheduledFor", quoteScheduledForUnix.toString());
      fd.set("signedEvent", JSON.stringify(quoteSignedEvent));
      if (entry.caption) {
        fd.set("quoteCaption", entry.caption);
      }
      const res = await fetch("/dashboard/scheduled", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Failed to schedule quote");
    }
  }
}
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
  const { signAttempt, signElapsedSeconds } =
    useSignAttemptProgress(isSigningEvent);

  // After successful remote signer reconnect, clear stuck signing state so user can retry.
  useEffect(() => {
    const handler = () => {
      setIsSigningEvent(false);
      setSigningError(null);
    };
    window.addEventListener("nostr-connection-healthy", handler);
    return () =>
      window.removeEventListener("nostr-connection-healthy", handler);
  }, []);

  // When awaiting signer approval, try background reconnect periodically.
  useEffect(() => {
    if (!isSigningEvent) return;
    let attempts = 0;
    const interval = setInterval(() => {
      void tryBackgroundReconnect();
      attempts++;
      if (attempts >= 5) clearInterval(interval);
    }, 10_000);
    return () => clearInterval(interval);
  }, [isSigningEvent]);

  // "Also schedule repost/quote" (only for regular posts) – hours after main post (multiple)
  const [alsoScheduleRepost, setAlsoScheduleRepost] = useState(false);
  const [repostDelayList, setRepostDelayList] = useState<
    Array<{ id: string; value: number; unit: DelayAfterMain["unit"] }>
  >([{ id: crypto.randomUUID(), value: 2, unit: "hours" }]);
  const [alsoScheduleQuote, setAlsoScheduleQuote] = useState(false);
  const [quoteEntries, setQuoteEntries] = useState<
    Array<{
      id: string;
      value: number;
      unit: DelayAfterMain["unit"];
      caption: string;
    }>
  >([{ id: crypto.randomUUID(), value: 2, unit: "hours", caption: "" }]);

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
    setContent,
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
    setEditorReady,
    longformEditorApiRef,
    form,
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
        setSigningError(getClientDisplayErrorMessage(data.error));
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
      showErrorToastFromUnknown(scheduleRepostQuoteFetcher.data.error);
    }
  }, [scheduleRepostQuoteFetcher.state, scheduleRepostQuoteFetcher.data]);

  const handleSubmit = async () => {
    try {
      setIsSigningEvent(true);
      setSigningError(null);
      setIsUploadingImages(true);

      // Flush Tiptap editor to form so content is current when longform
      if (isLongform) {
        longformEditorApiRef.current?.flushSync();
      }
      const contentToSubmit = isLongform ? form.getValues("content") : content;
      const contentValue: string | undefined =
        typeof contentToSubmit === "string" ? contentToSubmit : undefined;

      const result = await prepareEditPostSubmission({
        post,
        isLongform,
        caption,
        title,
        summary,
        content: contentValue,
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

      await runScheduleRepostQuoteIfNeeded(
        isLongform,
        mainSignedEvent,
        formData,
        post.id,
        repostDelayList,
        quoteEntries,
        alsoScheduleRepost,
        alsoScheduleQuote
      );
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
                aria-label="Close"
              >
                <X
                  className="h-6 w-6"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </button>
            </div>

            <div className="space-y-6">
              {isLongform ? (
                <EditLongFormFormFields
                  title={title}
                  setTitle={setTitle}
                  summary={summary}
                  setSummary={setSummary}
                  content={content}
                  onContentChange={setContent}
                  image={image}
                  setImage={setImage}
                  editorReady={editorReady}
                  onEditorReady={setEditorReady}
                  editorApiRef={longformEditorApiRef}
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
                  min={getNowForDateTimeLocal(user?.timezone ?? "UTC")}
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
                  className="bg-card border-border text-foreground focus:border-primary focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2"
                />
              </div>

              {/* Also schedule repost/quote - only for regular posts */}
              {!isLongform ? (
                <div className="border-border bg-muted/30 space-y-3 rounded-lg border p-4">
                  <div className="text-foreground text-sm font-medium">
                    Also schedule
                  </div>
                  <label
                    htmlFor="edit-modal-also-schedule-repost"
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id="edit-modal-also-schedule-repost"
                      checked={alsoScheduleRepost}
                      onCheckedChange={(c) => setAlsoScheduleRepost(c === true)}
                    />
                    <span className="text-sm">Schedule a repost</span>
                  </label>
                  {alsoScheduleRepost ? (
                    <div className="space-y-2">
                      <span className="text-muted-foreground mb-1 block text-xs">
                        When after main post (one per repost)
                      </span>
                      {repostDelayList.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            type="number"
                            min={1}
                            value={item.value}
                            aria-label="Delay value"
                            onChange={(e) => {
                              const v = Math.max(
                                1,
                                parseInt(e.target.value, 10) || 1
                              );
                              setRepostDelayList((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx]!, value: v };
                                return next;
                              });
                            }}
                            className="bg-card border-border text-foreground w-20 rounded-md border px-3 py-2 text-sm"
                          />
                          <select
                            value={item.unit}
                            onChange={(e) => {
                              const unit = e.target
                                .value as DelayAfterMain["unit"];
                              setRepostDelayList((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx]!, unit };
                                return next;
                              });
                            }}
                            className="bg-card border-border text-foreground w-24 rounded-md border px-2 py-2 text-sm"
                            aria-label="Hours or minutes"
                          >
                            <option value="hours">hours</option>
                            <option value="minutes">minutes</option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setRepostDelayList((prev) =>
                                prev.length > 1
                                  ? prev.filter((_, i) => i !== idx)
                                  : prev
                              )
                            }
                            disabled={repostDelayList.length <= 1}
                            aria-label="Remove repost"
                            className="text-muted-foreground hover:text-foreground text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setRepostDelayList((prev) => [
                            ...prev,
                            {
                              id: crypto.randomUUID(),
                              value: 24,
                              unit: "hours",
                            },
                          ])
                        }
                        className="text-primary text-xs hover:underline"
                      >
                        Add another repost
                      </button>
                    </div>
                  ) : null}
                  <label
                    htmlFor="edit-modal-also-schedule-quote"
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id="edit-modal-also-schedule-quote"
                      checked={alsoScheduleQuote}
                      onCheckedChange={(c) => setAlsoScheduleQuote(c === true)}
                    />
                    <span className="text-sm">Schedule a quote</span>
                  </label>
                  {alsoScheduleQuote ? (
                    <div className="space-y-3">
                      <span className="text-muted-foreground mb-1 block text-xs">
                        Quote times and captions (one per quote)
                      </span>
                      {quoteEntries.map((entry, idx) => (
                        <div
                          key={entry.id}
                          className="border-border space-y-2 rounded border p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label
                              htmlFor={`edit-quote-value-${idx}`}
                              className="text-muted-foreground text-xs"
                            >
                              When after main
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setQuoteEntries((prev) =>
                                  prev.length > 1
                                    ? prev.filter((_, i) => i !== idx)
                                    : prev
                                )
                              }
                              disabled={quoteEntries.length <= 1}
                              className="text-muted-foreground hover:text-foreground text-xs"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              id={`edit-quote-value-${idx}`}
                              type="number"
                              min={1}
                              value={entry.value}
                              onChange={(e) => {
                                const v = Math.max(
                                  1,
                                  parseInt(e.target.value, 10) || 1
                                );
                                setQuoteEntries((prev) => {
                                  const next = [...prev];
                                  const current = next[idx]!;
                                  next[idx] = { ...current, value: v };
                                  return next;
                                });
                              }}
                              className="bg-card border-border text-foreground w-20 rounded-md border px-3 py-2 text-sm"
                              aria-label="Delay value"
                            />
                            <select
                              value={entry.unit}
                              onChange={(e) => {
                                const unit = e.target
                                  .value as DelayAfterMain["unit"];
                                setQuoteEntries((prev) => {
                                  const next = [...prev];
                                  const current = next[idx]!;
                                  next[idx] = { ...current, unit };
                                  return next;
                                });
                              }}
                              className="bg-card border-border text-foreground w-24 rounded-md border px-2 py-2 text-sm"
                              aria-label="Hours or minutes"
                            >
                              <option value="hours">hours</option>
                              <option value="minutes">minutes</option>
                            </select>
                          </div>
                          <div>
                            <label
                              htmlFor={`edit-quote-caption-${idx}`}
                              className="text-muted-foreground text-xs"
                            >
                              Caption (optional)
                            </label>
                            <textarea
                              id={`edit-quote-caption-${idx}`}
                              value={entry.caption}
                              onChange={(e) =>
                                setQuoteEntries((prev) => {
                                  const next = [...prev];
                                  const current = next[idx]!;
                                  next[idx] = {
                                    ...current,
                                    caption: e.target.value,
                                  };
                                  return next;
                                })
                              }
                              placeholder="Add your comment..."
                              rows={2}
                              className="bg-card border-border text-foreground mt-1 w-full rounded-md border px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setQuoteEntries((prev) => [
                            ...prev,
                            {
                              id: crypto.randomUUID(),
                              value: 24,
                              unit: "hours",
                              caption: "",
                            },
                          ])
                        }
                        className="text-primary text-xs hover:underline"
                      >
                        Add another quote
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Re-signing notice */}
              <div className="border-border bg-muted dark:border-border dark:bg-muted/20 rounded-lg border p-4">
                <div className="flex items-start space-x-2">
                  <Info
                    className="text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0"
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                  <div>
                    <div className="text-foreground text-sm font-medium">
                      Editing this {isLongform ? "article" : "post"} requires
                      re-signing the Nostr event
                    </div>
                  </div>
                </div>
              </div>
              {isSigningEvent ? (
                <div className="bg-muted text-muted-foreground flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                  <span>
                    Waiting for signer approval…
                    {signAttempt ? (
                      <>
                        {" "}
                        Attempt {signAttempt.attempt} of{" "}
                        {signAttempt.maxAttempts} ·{" "}
                        {formatAttemptElapsed(
                          signElapsedSeconds,
                          signAttempt.timeoutMs
                        )}
                      </>
                    ) : null}
                    {" — "}
                    If you’re using a remote signer, open it to approve the
                    request.
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => {
                      setIsSigningEvent(false);
                      setSigningError(null);
                      void tryBackgroundReconnect();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}

              {/* Error display */}
              {(fetcher.data?.error ?? signingError) ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {fetcher.data?.error ?? signingError}
                  </AlertDescription>
                </Alert>
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
