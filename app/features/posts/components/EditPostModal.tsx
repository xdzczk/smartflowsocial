import { useFetcher } from "@remix-run/react";
import { Info, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Separator } from "~/components/ui/separator";
import { StatusIcon } from "~/components/ui/status-icon";
import { cancelSignerInFlight } from "~/features/auth/signer";
import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import {
  durableIntent,
  startRecoverableSign,
} from "~/features/auth/signing/use-recoverable-sign.client";
import { useComposerSignerReconnect } from "~/features/posts/composer/hooks/useComposerSignerReconnect";
import { NostrResignNotice } from "~/features/posts/scheduled/components/NostrResignNotice";
import { RescheduleScheduledPostModal } from "~/features/posts/scheduling";
import {
  logClientError,
  getClientDisplayErrorMessage,
  showErrorToastFromUnknown,
} from "~/lib/error-handler.client";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  describeSignerPhase,
  useSignAttemptProgress,
} from "~/lib/hooks/useSignAttemptProgress";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import {
  fromDate,
  getNowForDateTimeLocal,
  parseDateTimeLocal,
  toDate,
} from "~/lib/temporal";
import { cn } from "~/lib/utils";

import { useEditPostModal } from "../hooks/useEditPostModal";
import type {
  PostData,
  LongFormPostData,
  QueueType,
  HashTagPreset,
  UserData,
  RepostConditions,
} from "../types";
import { type DelayAfterMain } from "../utils/delay-after-main";
import { runScheduleRepostQuoteIfNeeded } from "../utils/edit-post-repost-quote.client";
import { prepareEditPostSubmission } from "../utils/editPostSubmit.client";

// eslint-disable-next-line import/order -- parent and sibling groups adjacent
import { EditLongFormFormFields } from "~/features/posts/longform";
import { EditPostFormFields } from "./EditPostFormFields";
import { formatScheduledDate } from "./post-detail-modal/post-detail-helpers";

export interface EditPostModalProps {
  post: PostData | LongFormPostData;
  onClose: () => void;
  onConfirm: () => void;
  user?: UserData;
  queueTypes?: QueueType[];
  hashTagPresets?: HashTagPreset[];
  /** Unified mini-composer layout for scheduled posts (Dashboard / Calendar / Scheduled). */
  variant?: "default" | "scheduledMini";
}

interface FetcherData {
  success?: boolean;
  needsSigning?: boolean;
  error?: string;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- scheduled edit modal: signing, repost/quote, reschedule
export function EditPostModal({
  post,
  onClose,
  onConfirm,
  user,
  queueTypes = [],
  hashTagPresets = [],
  variant = "default",
}: EditPostModalProps) {
  const isMini = variant === "scheduledMini";
  const { dateLocale } = useFormattedDate();
  const userTimeFormat =
    user && typeof user === "object" && "timeFormat" in user
      ? user.timeFormat === "24h"
        ? "24h"
        : "12h"
      : "12h";
  const userTimezone =
    user && typeof user === "object" && "timezone" in user
      ? String(user.timezone)
      : "UTC";

  const fetcher = useFetcher<FetcherData>();
  const deleteFetcher = useFetcher();
  const scheduleRepostQuoteFetcher = useFetcher<{
    success?: boolean;
    error?: string;
  }>();
  const [isSigningEvent, setIsSigningEvent] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const { signAttempt, signElapsedSeconds } =
    useSignAttemptProgress(isSigningEvent);
  const signPhaseStatus = describeSignerPhase(
    signAttempt?.phase,
    signElapsedSeconds,
    signAttempt?.timeoutMs
  );
  const pendingRetryRef = useRef<(() => void) | null>(null);
  // Tracks the in-flight signing attempt so the fetcher.data effect can
  // mark it completed/failed once the server response lands. Mirrors the
  // pattern used by RescheduleScheduledPostModal.
  const inFlightAttemptIdRef = useRef<string | null>(null);

  const clearSigningState = () => {
    setIsSigningEvent(false);
    setSigningError(null);
  };
  const cancelSigningState = () => {
    pendingRetryRef.current = null;
    inFlightAttemptIdRef.current = null;
    clearSigningState();
  };
  const retryLastSign = (): boolean => {
    const fn = pendingRetryRef.current;
    if (!fn) return false;
    pendingRetryRef.current = null;
    fn();
    return true;
  };
  useComposerSignerReconnect(cancelSigningState, isSigningEvent, retryLastSign);

  // "Also schedule repost/quote" (only for regular posts) – hours after main post (multiple)
  const [alsoScheduleRepost, setAlsoScheduleRepost] = useState(false);
  const [repostDelayList, setRepostDelayList] = useState<
    Array<{ id: string; value: number; unit: DelayAfterMain["unit"] }>
  >([{ id: crypto.randomUUID(), value: 2, unit: "hours" }]);
  const [repostConditions, setRepostConditions] =
    useState<RepostConditions | null>(null);
  const [alsoScheduleQuote, setAlsoScheduleQuote] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
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
    includeHashtagsInNoteBody,
    setIncludeHashtagsInNoteBody,
    mediaUploadBlocked,
  } = useEditPostModal({
    post,
    user,
    hashTagPresets,
    queueTypes,
    isLongform,
  });

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    const dataRaw = fetcher.data;
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as {
            success?: unknown;
            needsSigning?: unknown;
            error?: unknown;
          })
        : null;
    const attemptId = inFlightAttemptIdRef.current;
    if (data && typeof data.success === "boolean" && data.success) {
      if (
        data.needsSigning &&
        typeof data.needsSigning === "boolean" &&
        data.needsSigning
      ) {
        return; // Keep modal open for re-signing
      }
      if (attemptId) {
        signingAttempts.markCompleted(attemptId);
        inFlightAttemptIdRef.current = null;
      }
      toast.success("Post updated");
      onConfirm();
    }
    if (data && "error" in data && typeof data.error === "string") {
      const message = getClientDisplayErrorMessage(data.error);
      if (attemptId) {
        signingAttempts.markFailed(attemptId, message);
        inFlightAttemptIdRef.current = null;
      }
      // Defer to avoid cascading renders
      setTimeout(() => {
        setSigningError(message);
      }, 0);
    }
  }, [fetcher.state, fetcher.data, onConfirm]);

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

  useEffect(() => {
    if (deleteFetcher.state !== "idle" || !deleteFetcher.data) return;
    const raw = deleteFetcher.data as { success?: boolean; error?: unknown };
    if (raw.error || !raw.success) return;
    const fd = deleteFetcher.formData as FormData | undefined;
    const action = fd?.get("_action");
    const pid = fd?.get("postId");
    const expectAction = isLongform ? "deleteLongForm" : "delete";
    if (action === expectAction && String(pid) === String(post.id)) {
      toast.success("Scheduled post deleted");
      onConfirm();
      onClose();
    }
  }, [
    deleteFetcher.state,
    deleteFetcher.data,
    deleteFetcher.formData,
    post.id,
    isLongform,
    onConfirm,
    onClose,
  ]);

  const requestClose = () => {
    if (isMini && form.formState.isDirty) {
      if (!window.confirm("Discard your changes?")) return;
    }
    onClose();
  };

  const handleSubmit = async () => {
    setIsSigningEvent(true);
    setSigningError(null);
    pendingRetryRef.current = () => void handleSubmit();
    setIsUploadingImages(true);

    // Flush Tiptap editor to form so content is current when longform
    if (isLongform) {
      longformEditorApiRef.current?.flushSync();
    }
    const contentToSubmit = isLongform ? form.getValues("content") : content;
    const contentValue: string | undefined =
      typeof contentToSubmit === "string" ? contentToSubmit : undefined;

    // Idempotency key collapses a resumed retry onto the same server
    // dedupe slot: same post + same target time => same attempt, even
    // if the user reopens the modal after the bunker drops mid-sign.
    const targetTimeUnix = scheduledFor
      ? Math.floor(scheduledFor.getTime() / 1000)
      : 0;
    const idempotencyKey = `edit_post:${post.id}:${String(targetTimeUnix)}`;

    // Wrap captured-by-closure values in an object so TS doesn't narrow
    // them down to `null` after the closure runs (the recoverable wrapper
    // assigns these inside `performSignAndSubmit`, which TS flow analysis
    // cannot see from the outer scope).
    const captured: {
      formData: FormData | null;
      signedEvent: Record<string, unknown> | null;
    } = { formData: null, signedEvent: null };

    const result = await startRecoverableSign({
      intent: durableIntent("composer_publish", idempotencyKey, "Edit post"),
      surface: `edit_post:${post.id}`,
      performSignAndSubmit: async (submissionId) => {
        const prepared = await prepareEditPostSubmission({
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
          includeHashtagsInNoteBody,
        });

        const formData = "formData" in prepared ? prepared.formData : prepared;
        const mainSignedEvent =
          "signedEvent" in prepared && prepared.signedEvent
            ? prepared.signedEvent
            : null;
        // Forward the per-attempt id so the route's downstream
        // /api/publish dedupe (PR 0) collapses any resumed retry onto
        // the original side-effect.
        formData.append("attemptId", submissionId);

        captured.formData = formData;
        captured.signedEvent = mainSignedEvent as Record<
          string,
          unknown
        > | null;

        pendingRetryRef.current = null;
        setIsSigningEvent(false);
        setIsUploadingImages(false);
        inFlightAttemptIdRef.current = submissionId;
        fetcher.submit(formData, { method: "post" });
        // The fetcher.data effect promotes the attempt to `completed`
        // (or `failed`) once the server response settles. Returning
        // here parks the store state in `submitting`.
      },
    });

    if (result.ok) {
      if (captured.signedEvent && captured.formData) {
        try {
          await runScheduleRepostQuoteIfNeeded(
            isLongform,
            captured.signedEvent,
            captured.formData,
            post.id,
            repostDelayList,
            quoteEntries,
            alsoScheduleRepost,
            alsoScheduleQuote,
            repostConditions
          );
        } catch (error: unknown) {
          showErrorToastFromUnknown(error);
        }
      }
      return;
    }

    pendingRetryRef.current = null;
    setIsSigningEvent(false);
    setIsUploadingImages(false);
    inFlightAttemptIdRef.current = null;

    if (result.reason === "fatal") {
      logClientError(
        result.lastError ? new Error(result.lastError) : new Error("sign fail"),
        {
          component: "EditPostModal",
          action: "prepareEditPostSubmission",
          message: "Error re-signing event",
        }
      );
      setSigningError(
        result.lastError ?? "Failed to sign event. Please try again."
      );
    } else if (result.reason === "expired") {
      setSigningError(
        "Recovery window expired before your signer reconnected."
      );
    }
  };

  const scheduledSummary = formatScheduledDate(
    "scheduledAtUtc" in post && post.scheduledAtUtc
      ? post.scheduledAtUtc instanceof Date
        ? post.scheduledAtUtc
        : new Date(post.scheduledAtUtc)
      : null,
    userTimezone,
    userTimeFormat,
    dateLocale
  );
  const queueSummary =
    "queueType" in post && post.queueType?.name
      ? post.queueType.name
      : "Manual (No Queue)";

  return (
    <>
      <div className="bg-scrim/50 fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            "bg-surface-overlay shadow-3 max-h-[90vh] w-full overflow-hidden rounded-xl",
            isMini ? "max-w-4xl" : "max-w-2xl"
          )}
        >
          <div
            className={cn(
              "flex max-h-[85vh] min-h-0",
              isMini ? "flex-col md:flex-row" : "flex-col overflow-y-auto"
            )}
          >
            <div
              className={cn(
                "min-h-0 min-w-0",
                isMini ? "flex-1 overflow-y-auto p-6" : "overflow-y-auto p-6"
              )}
            >
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-text text-xl font-semibold">
                  {isMini
                    ? "Edit Post"
                    : `Edit ${isLongform ? "Article" : "Post"}`}
                </h3>
                <button
                  type="button"
                  onClick={isMini ? requestClose : onClose}
                  className="text-text-secondary hover:text-text"
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
                    includeHashtagsInNoteBody={includeHashtagsInNoteBody}
                    setIncludeHashtagsInNoteBody={setIncludeHashtagsInNoteBody}
                    mediaAddDisabled={mediaUploadBlocked}
                    hideQueueField={isMini}
                  />
                )}

                {!isMini ? (
                  <div>
                    <label
                      htmlFor="edit-post-scheduled-for"
                      className="text-text-secondary mb-2 block text-sm font-medium"
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
                      className="focus-ring bg-surface border-border text-text focus:border-brand w-full rounded-md border px-3 py-2"
                    />
                  </div>
                ) : null}

                {/* Also schedule repost/quote - only for regular posts */}
                {!isLongform ? (
                  <div className="border-border bg-surface-hover/30 space-y-3 rounded-lg border p-4">
                    <div className="text-text text-sm font-medium">
                      Also schedule
                    </div>
                    <label
                      htmlFor="edit-modal-also-schedule-repost"
                      className="cluster"
                    >
                      <Checkbox
                        id="edit-modal-also-schedule-repost"
                        checked={alsoScheduleRepost}
                        onCheckedChange={(c) =>
                          setAlsoScheduleRepost(c === true)
                        }
                      />
                      <span className="text-sm">Schedule a repost</span>
                    </label>
                    {alsoScheduleRepost ? (
                      <div className="space-y-2">
                        <span className="text-text-secondary mb-1 block text-xs">
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
                              className="bg-surface border-border text-text w-20 rounded-md border px-3 py-2 text-sm"
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
                              className="bg-surface border-border text-text w-24 rounded-md border px-2 py-2 text-sm"
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
                              className="text-text-secondary hover:text-text text-xs"
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
                          className="text-link hover:text-link-hover text-xs hover:underline"
                        >
                          Add another repost
                        </button>
                        <div className="border-border mt-3 space-y-1.5 rounded-xs border p-3">
                          <span className="text-text-secondary text-xs">
                            Only repost if original gets (optional)
                          </span>
                          <div className="flex flex-wrap items-center gap-3 gap-y-1.5">
                            {[
                              {
                                key: "minReactions" as const,
                                label: "Reactions",
                              },
                              { key: "minZaps" as const, label: "Zaps" },
                              {
                                key: "minComments" as const,
                                label: "Comments",
                              },
                              { key: "minReposts" as const, label: "Reposts" },
                              { key: "minSats" as const, label: "Sats" },
                            ].map(({ key, label }) => (
                              <div key={key} className="cluster-tight.5">
                                <label className="text-text-secondary text-xs whitespace-nowrap">
                                  {label}
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="—"
                                  value={repostConditions?.[key] ?? ""}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const v =
                                      raw.trim() === ""
                                        ? undefined
                                        : Math.max(0, parseInt(raw, 10) || 0);
                                    setRepostConditions((prev) => {
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
                                  className="bg-surface border-border text-text w-20 rounded-md border px-2 py-1.5 text-sm"
                                  aria-label={`Min ${label.toLowerCase()}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <label
                      htmlFor="edit-modal-also-schedule-quote"
                      className="cluster"
                    >
                      <Checkbox
                        id="edit-modal-also-schedule-quote"
                        checked={alsoScheduleQuote}
                        onCheckedChange={(c) =>
                          setAlsoScheduleQuote(c === true)
                        }
                      />
                      <span className="text-sm">Schedule a quote</span>
                    </label>
                    {alsoScheduleQuote ? (
                      <div className="space-y-3">
                        <span className="text-text-secondary mb-1 block text-xs">
                          Quote times and captions (one per quote)
                        </span>
                        {quoteEntries.map((entry, idx) => (
                          <div
                            key={entry.id}
                            className="border-border space-y-2 rounded-xs border p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label
                                htmlFor={`edit-quote-value-${idx}`}
                                className="text-text-secondary text-xs"
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
                                className="text-text-secondary hover:text-text text-xs"
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
                                className="bg-surface border-border text-text w-20 rounded-md border px-3 py-2 text-sm"
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
                                className="bg-surface border-border text-text w-24 rounded-md border px-2 py-2 text-sm"
                                aria-label="Hours or minutes"
                              >
                                <option value="hours">hours</option>
                                <option value="minutes">minutes</option>
                              </select>
                            </div>
                            <div>
                              <label
                                htmlFor={`edit-quote-caption-${idx}`}
                                className="text-text-secondary text-xs"
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
                                className="bg-surface border-border text-text mt-1 w-full rounded-md border px-3 py-2 text-sm"
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
                          className="text-link hover:text-link-hover text-xs hover:underline"
                        >
                          Add another quote
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Re-signing notice */}
                {isMini ? (
                  <NostrResignNotice variant="contentChange" />
                ) : (
                  <div className="border-border bg-surface-hover dark:border-border dark:bg-surface-hover/20 rounded-lg border p-4">
                    <div className="flex items-start space-x-2">
                      <StatusIcon
                        tone="neutral"
                        icon={Info}
                        size="lg"
                        className="text-text-secondary mt-0.5"
                      />
                      <div>
                        <div className="text-text text-sm font-medium">
                          Editing this {isLongform ? "article" : "post"}{" "}
                          requires re-signing the Nostr event
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {isSigningEvent ? (
                  <div className="bg-surface-hover text-text-secondary flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <span>
                      Waiting for signer approval…
                      {signPhaseStatus ? <> {signPhaseStatus}</> : null}
                      {" - Approve this request in your remote signer."}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-text-secondary hover:text-text shrink-0"
                      onClick={() => {
                        cancelSigningState();
                        cancelSignerInFlight();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}

                {/* Error display */}
                {(() => {
                  const serverErr =
                    fetcher.data?.error != null
                      ? getClientDisplayErrorMessage(fetcher.data.error)
                      : null;
                  const displayError = signingError ?? serverErr;
                  return displayError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{displayError}</AlertDescription>
                    </Alert>
                  ) : null;
                })()}
              </div>

              {!isMini ? (
                <div className="mt-6 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-text-secondary hover:text-text px-4 py-2 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={
                      fetcher.state === "submitting" ||
                      isSigningEvent ||
                      isUploadingImages
                    }
                    className="bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploadingImages
                      ? "Uploading Images..."
                      : isSigningEvent
                        ? "Signing Event..."
                        : fetcher.state === "submitting"
                          ? "Saving..."
                          : "Save changes"}
                  </button>
                </div>
              ) : null}
            </div>
            {isMini ? (
              <aside className="border-border flex w-full shrink-0 flex-col justify-between gap-4 border-t p-4 md:w-72 md:border-t-0 md:border-l">
                <div className="space-y-3">
                  <div>
                    <p className="text-text-secondary text-xs font-medium">
                      Status
                    </p>
                    <p className="text-text text-sm">Scheduled</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-xs font-medium">
                      Scheduled for
                    </p>
                    <p className="text-text text-sm">{scheduledSummary}</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-xs font-medium">
                      Queue
                    </p>
                    <p className="text-text text-sm">{queueSummary}</p>
                  </div>
                  <Separator />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setRescheduleOpen(true)}
                  >
                    Reschedule…
                  </Button>
                </div>
                <div className="stack-tight">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={requestClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void handleSubmit()}
                    disabled={
                      fetcher.state === "submitting" ||
                      isSigningEvent ||
                      isUploadingImages
                    }
                  >
                    {isUploadingImages
                      ? "Uploading…"
                      : isSigningEvent
                        ? "Signing…"
                        : fetcher.state === "submitting"
                          ? "Saving…"
                          : "Save changes"}
                  </Button>
                  <deleteFetcher.Form
                    method="post"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input type="hidden" name="postId" value={post.id} />
                    <input
                      type="hidden"
                      name="_action"
                      value={isLongform ? "deleteLongForm" : "delete"}
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      className="text-danger hover:text-danger w-full"
                      disabled={deleteFetcher.state !== "idle"}
                    >
                      {deleteFetcher.state !== "idle"
                        ? "Deleting…"
                        : "Delete scheduled post"}
                    </Button>
                  </deleteFetcher.Form>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>

      {isMini && rescheduleOpen ? (
        <RescheduleScheduledPostModal
          post={post}
          user={user}
          queueTypes={queueTypes}
          userTimeFormat={userTimeFormat}
          onClose={() => setRescheduleOpen(false)}
          onSuccess={() => {
            setRescheduleOpen(false);
            onConfirm();
          }}
        />
      ) : null}
    </>
  );
}
