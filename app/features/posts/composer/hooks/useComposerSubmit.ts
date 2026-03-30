/**
 * Composer submit/schedule orchestration: build payload, call actions, handle loading and errors.
 */

import * as React from "react";

import type { SignedEvent } from "~/features/nostr/types";
import { buildThreadSubmitFormData } from "~/features/posts/composer/composer-submit/build-thread-submit-form-data";
import { signThreadSegmentsWithRetry } from "~/features/posts/composer/composer-submit/sign-thread-segments";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { applyRandomScheduleWindow } from "~/lib/schedule-random";
import { nowMillis } from "~/lib/temporal";

import { resolveContentForSigning } from "../../utils/inline-tokens.client";
import {
  ACTION_POST_TEXT,
  ACTION_SCHEDULE_TEXT,
  getEffectiveHashtagsForSubmit,
  parseScheduledTime,
  buildRepostSchedules,
  buildQuoteSchedules,
  type SignedEventLike,
} from "../components/composer/composer-submit-utils";
import {
  COMPOSER_CONTENT_REQUIRED,
  COMPOSER_SCHEDULE_FUTURE,
  COMPOSER_SCHEDULE_OR_QUEUE_REQUIRED,
  COMPOSER_UPLOAD_WAIT,
  COMPOSER_REMOVE_FAILED_ATTACHMENTS,
} from "../components/composer/composer-validation";
import { MIN_THREAD_SEGMENTS } from "../components/composer/thread-constants";

import type {
  TextPostFormData,
  ThreadSegment,
  UseComposerSubmitOptions,
} from "./composer-submit-types";

export type { TextPostFormData, ThreadSegment, UseComposerSubmitOptions };

export function useComposerSubmit(options: UseComposerSubmitOptions) {
  const {
    form,
    fetcher,
    setPublishSubmitInFlight,
    setLastPublishFailed,
    isTemplateMode,
    templateName,
    editTemplateContext,
    clearLocalSnapshot,
    attachments,
    selectedHashtags,
    selectedQueue,
    queueTypeId,
    queueTypes,
    initialDraftId,
    relayOverride,
    scheduleRandomWindowMinutes,
    alsoScheduleRepost,
    repostDelayList,
    repostConditions,
    alsoScheduleQuote,
    quoteEntries,
    isThreadMode,
    threadSegments,
    threadDelayMinutes,
    user,
    defaultTags = [],
    submitAction,
    embedContext,
    publishMode = "now",
    calculateQueueScheduleTime,
    onBeginSaveDraft,
  } = options;

  const fetcherSubmitOptions = React.useMemo(
    () =>
      submitAction
        ? { method: "post" as const, action: submitAction }
        : { method: "post" as const },
    [submitAction]
  );

  const [isSigning, setIsSigning] = React.useState(false);
  const [signingError, setSigningError] = React.useState<string | null>(null);
  const [partialThreadState, setPartialThreadState] = React.useState<{
    signedEvents: SignedEvent[];
    failedIndices: number[];
    data: TextPostFormData;
    submitType: string;
  } | null>(null);
  const lastSubmitForRetryRef = React.useRef<{
    data: TextPostFormData;
    event: React.BaseSyntheticEvent | undefined;
  } | null>(null);
  /** Bumped on cancel/reconnect-without-retry or new submit so stale sign completions do not submit twice. */
  const submitGenerationRef = React.useRef(0);

  const runSubmit = React.useCallback(
    async (data: TextPostFormData, event?: React.BaseSyntheticEvent) => {
      const submitter = event?.nativeEvent
        ? ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)
        : undefined;
      const submitType = submitter?.value ?? "";

      function submitTemplateSave(): void {
        if (!templateName.trim()) return;
        clearLocalSnapshot();
        const formData = new FormData();
        if (editTemplateContext?.templateId && editTemplateContext.postId) {
          formData.set("_action", "updateTemplatePost");
          formData.set("templateId", editTemplateContext.templateId);
          formData.set("postId", editTemplateContext.postId);
          formData.set("name", templateName.trim());
        } else {
          formData.set("_action", "createTemplate");
          formData.set("templateName", templateName.trim());
        }
        formData.set("content", data.content);
        formData.set("queueType", "unassigned");
        formData.set("tags", selectedHashtags);
        if (data.hashTagPresetId)
          formData.set("hashTagPresetId", data.hashTagPresetId);
        formData.set(
          "useHashtagPresets",
          String(Boolean(data.useHashtagPresets))
        );
        formData.set(
          "includeHashtagsInNoteBody",
          String(Boolean(data.includeHashtagsInNoteBody))
        );
        const draftAttachmentMeta = attachments
          .filter((a) => a.url)
          .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt }));
        if (draftAttachmentMeta.length > 0) {
          formData.set("attachmentMeta", JSON.stringify(draftAttachmentMeta));
        }
        if (embedContext) formData.set("_embedContext", embedContext);
        fetcher.submit(formData, fetcherSubmitOptions);
      }

      function submitDraftSave(): void {
        clearLocalSnapshot();
        const formData = new FormData();
        formData.set("_action", "save-draft");
        formData.set("content", data.content);
        formData.set("queueType", data.queueType);
        if (queueTypeId) formData.set("queueTypeId", queueTypeId);
        if (data.scheduledFor) formData.set("scheduledFor", data.scheduledFor);
        formData.set("tags", selectedHashtags);
        if (data.hashTagPresetId)
          formData.set("hashTagPresetId", data.hashTagPresetId);
        if (initialDraftId) formData.set("draftId", initialDraftId);
        if (relayOverride && relayOverride.length > 0) {
          formData.set("relays", JSON.stringify(relayOverride));
        }
        const draftAttachmentMeta = attachments
          .filter((a) => a.url)
          .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt }));
        if (draftAttachmentMeta.length > 0) {
          formData.set("attachmentMeta", JSON.stringify(draftAttachmentMeta));
        }
        formData.set(
          "includeHashtagsInNoteBody",
          String(Boolean(data.includeHashtagsInNoteBody))
        );
        if (embedContext) formData.set("_embedContext", embedContext);
        fetcher.submit(formData, fetcherSubmitOptions);
      }

      if (isTemplateMode && submitType === "save-as-template") {
        submitTemplateSave();
        return;
      }
      // Rail uses `value="save-draft"`; legacy buttons may use `draft-text`. Both skip signing.
      if (submitType === "draft-text" || submitType === "save-draft") {
        onBeginSaveDraft?.();
        submitDraftSave();
        return;
      }

      async function resolveScheduleLocalInput(
        d: TextPostFormData,
        activeSubmitType: string
      ): Promise<string> {
        if (activeSubmitType !== ACTION_SCHEDULE_TEXT) {
          return d.scheduledFor ?? "";
        }
        let s = d.scheduledFor?.trim() ?? "";
        if (
          publishMode === "queue" &&
          selectedQueue !== "unassigned" &&
          !s &&
          calculateQueueScheduleTime
        ) {
          const computed = await calculateQueueScheduleTime(selectedQueue);
          if (computed) {
            form.setValue("scheduledFor", computed);
            return computed;
          }
        }
        return d.scheduledFor ?? "";
      }

      async function runThreadSubmit(): Promise<void> {
        let generation: number | null = null;
        try {
          setSigningError(null);
          const hasUploading = threadSegments.some((s) =>
            s.attachments.some(
              (a) => a.status === "uploading" || a.status === "failed"
            )
          );
          if (hasUploading) {
            setSigningError(
              "Wait for uploads or remove failed attachments in each segment."
            );
            return;
          }
          if (threadSegments.length < MIN_THREAD_SEGMENTS) {
            setSigningError(
              `A thread must have at least ${MIN_THREAD_SEGMENTS} segments.`
            );
            return;
          }
          const segmentMissingBody = threadSegments.some(
            (s) => s.content.trim() === "" && s.attachments.length === 0
          );
          if (segmentMissingBody) {
            setSigningError(
              "Every thread segment must include text or at least one media item."
            );
            return;
          }
          const userTimezone = user?.timezone ?? "UTC";
          const threadScheduleInput = await resolveScheduleLocalInput(
            data,
            submitType
          );
          if (
            submitType === ACTION_SCHEDULE_TEXT &&
            !threadScheduleInput.trim()
          ) {
            setSigningError(COMPOSER_SCHEDULE_OR_QUEUE_REQUIRED);
            return;
          }
          const nominalThreadBase =
            submitType === ACTION_POST_TEXT
              ? Math.floor(Date.now() / 1000)
              : Math.floor(
                  (await parseScheduledTime(
                    threadScheduleInput,
                    userTimezone
                  )) / 1000
                );
          if (
            submitType === ACTION_SCHEDULE_TEXT &&
            nominalThreadBase * 1000 < Date.now()
          ) {
            setSigningError(COMPOSER_SCHEDULE_FUTURE);
            return;
          }
          const threadRandomMinutes = scheduleRandomWindowMinutes;
          const threadSignBase =
            submitType === ACTION_SCHEDULE_TEXT && threadRandomMinutes > 0
              ? applyRandomScheduleWindow(
                  nominalThreadBase,
                  threadRandomMinutes
                )
              : nominalThreadBase;
          const effectiveHashtags = await getEffectiveHashtagsForSubmit(
            data.useHashtagPresets,
            selectedHashtags,
            selectedQueue,
            queueTypes,
            user?.id,
            defaultTags
          );
          const tagArray = effectiveHashtags
            .split(" ")
            .filter((tag) => tag.length > 0)
            .map((tag) => ["t", tag.replace("#", "")]);

          generation = ++submitGenerationRef.current;
          lastSubmitForRetryRef.current = { data, event };
          setIsSigning(true);
          const { signedByIndex, failedIndices } =
            await signThreadSegmentsWithRetry({
              segments: threadSegments,
              baseTime: threadSignBase,
              tagArray,
              effectiveHashtags,
              threadDelayMinutes,
              includeHashtagsInNoteBody:
                data.includeHashtagsInNoteBody !== false,
            });
          if (generation !== submitGenerationRef.current) {
            return;
          }
          lastSubmitForRetryRef.current = null;
          setIsSigning(false);

          const firstFailedIndex = signedByIndex.findIndex((e) => e == null);
          const signedEvents =
            firstFailedIndex < 0
              ? (signedByIndex as SignedEvent[])
              : (signedByIndex.slice(0, firstFailedIndex) as SignedEvent[]);

          if (failedIndices.length > 0) {
            setPartialThreadState({
              signedEvents,
              failedIndices,
              data,
              submitType,
            });
            return;
          }

          const segmentsToSubmit = threadSegments.slice(0, signedEvents.length);
          const builtThread = buildThreadSubmitFormData({
            segmentsToSubmit,
            signedEvents,
            formData: data,
            actionSubmitType: submitType,
            threadSchedule:
              submitType === ACTION_SCHEDULE_TEXT
                ? {
                    scheduledFirstUnix: threadSignBase,
                    nominalFirstUnix:
                      threadRandomMinutes > 0 ? nominalThreadBase : undefined,
                  }
                : undefined,
            queueTypeId: queueTypeId ?? undefined,
            threadDelayMinutes,
            relayOverride,
            embedContext: embedContext ?? undefined,
          });
          if (!builtThread.ok) {
            setSigningError(builtThread.reason);
            return;
          }
          const threadPayload = builtThread.formData;

          setLastPublishFailed(false);
          setPublishSubmitInFlight(true);
          fetcher.submit(threadPayload, fetcherSubmitOptions);
        } catch (err) {
          if (
            generation != null &&
            generation === submitGenerationRef.current
          ) {
            lastSubmitForRetryRef.current = null;
            setIsSigning(false);
          }
          if (
            generation != null &&
            generation !== submitGenerationRef.current
          ) {
            return;
          }
          const { handleAsyncError } =
            await import("~/lib/error-handler.client");
          handleAsyncError(
            err,
            { component: "UnifiedComposer", action: "handleSubmitThread" },
            false
          );
          setSigningError(
            err instanceof Error ? err.message : "Failed to sign thread."
          );
        }
      }

      function getSinglePostValidationError(): string | null {
        if (!data.content.trim()) return COMPOSER_CONTENT_REQUIRED;
        if (attachments.some((a) => a.status === "uploading"))
          return COMPOSER_UPLOAD_WAIT;
        if (attachments.some((a) => a.status === "failed"))
          return COMPOSER_REMOVE_FAILED_ATTACHMENTS;
        return null;
      }

      function applySinglePostValidationError(
        validationError: string | null
      ): boolean {
        if (!validationError) return false;
        setSigningError(validationError);
        if (validationError === COMPOSER_CONTENT_REQUIRED) {
          form.setError("content", {
            type: "manual",
            message: COMPOSER_CONTENT_REQUIRED,
          });
        }
        return true;
      }

      async function runSinglePostSubmit(): Promise<void> {
        let generation: number | null = null;
        try {
          setSigningError(null);
          if (applySinglePostValidationError(getSinglePostValidationError())) {
            return;
          }
          const userTimezone = user?.timezone ?? "UTC";
          const scheduledForInput = await resolveScheduleLocalInput(
            data,
            submitType
          );
          if (
            submitType === ACTION_SCHEDULE_TEXT &&
            !scheduledForInput.trim()
          ) {
            setSigningError(COMPOSER_SCHEDULE_OR_QUEUE_REQUIRED);
            return;
          }
          const scheduledTime =
            submitType === ACTION_POST_TEXT
              ? nowMillis()
              : await parseScheduledTime(scheduledForInput, userTimezone);
          const nominalUnix = Math.floor(scheduledTime / 1000);
          const isSchedule = submitType === ACTION_SCHEDULE_TEXT;
          if (isSchedule && nominalUnix * 1000 < Date.now()) {
            setSigningError(COMPOSER_SCHEDULE_FUTURE);
            return;
          }
          const effectiveRandomMinutes = scheduleRandomWindowMinutes;
          const scheduledForUnix =
            isSchedule && effectiveRandomMinutes > 0
              ? applyRandomScheduleWindow(nominalUnix, effectiveRandomMinutes)
              : nominalUnix;

          const effectiveHashtags = await getEffectiveHashtagsForSubmit(
            data.useHashtagPresets,
            selectedHashtags,
            selectedQueue,
            queueTypes,
            user?.id,
            defaultTags
          );
          const tagArray = effectiveHashtags
            .split(" ")
            .filter((tag) => tag.length > 0)
            .map((tag) => ["t", tag.replace("#", "")]);

          const attachmentsWithUrl = attachments.filter((a) => a.url);
          const contentResolvedForSign = resolveContentForSigning(
            data.content,
            attachmentsWithUrl
          );
          const appendTagsSingle = data.includeHashtagsInNoteBody !== false;
          const contentToSign = appendTagsSingle
            ? `${contentResolvedForSign}\n${effectiveHashtags}`
            : contentResolvedForSign;

          generation = ++submitGenerationRef.current;
          lastSubmitForRetryRef.current = { data, event };
          setIsSigning(true);
          const { nostrEvent, signedEvent } =
            await nostrAdapter.signEventWithOneRetry({
              content: contentToSign,
              created_at: scheduledForUnix,
              kind: 1,
              tags: tagArray,
            });
          if (generation !== submitGenerationRef.current) {
            return;
          }
          lastSubmitForRetryRef.current = null;
          setIsSigning(false);

          const payload: Record<string, string> = {
            _action: submitType,
            content: data.content,
            queueType: data.queueType,
            nostrEvent: JSON.stringify(nostrEvent),
            signedEvent: JSON.stringify(signedEvent),
            scheduledFor: scheduledForUnix.toString(),
          };
          if (
            submitType === ACTION_SCHEDULE_TEXT &&
            effectiveRandomMinutes > 0
          ) {
            payload["nominalScheduledFor"] = String(nominalUnix);
          }
          if (data["isRecyclable"]) payload["isRecyclable"] = "on";
          if (data["useHashtagPresets"] && data["hashTagPresetId"]) {
            payload["hashTagPresetId"] = data["hashTagPresetId"];
            payload["useHashtagPresets"] = "on";
          }
          payload["includeHashtagsInNoteBody"] = String(
            Boolean(data.includeHashtagsInNoteBody)
          );
          if (relayOverride && relayOverride.length > 0) {
            payload["relays"] = JSON.stringify(relayOverride);
          }
          const attachmentMeta = attachments
            .filter((a) => a.url)
            .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt }));
          if (attachmentMeta.length > 0) {
            payload["attachmentMeta"] = JSON.stringify(attachmentMeta);
          }

          async function addRepostAndQuoteToPayload(
            p: Record<string, string>
          ): Promise<boolean> {
            if (alsoScheduleRepost && repostDelayList.length > 0) {
              const repostSchedules = await buildRepostSchedules(
                scheduledForUnix,
                repostDelayList.map((item) => ({
                  value: item.value,
                  unit: item.unit,
                })),
                signedEvent as SignedEventLike,
                setSigningError
              );
              if (repostSchedules == null) return false;
              if (repostSchedules.length > 0) {
                const withConditions =
                  repostConditions && Object.keys(repostConditions).length > 0
                    ? repostSchedules.map((s) => ({
                        ...s,
                        ...repostConditions,
                      }))
                    : repostSchedules;
                p["repostSchedules"] = JSON.stringify(withConditions);
              }
            }
            if (alsoScheduleQuote && quoteEntries.length > 0) {
              const quoteSchedules = await buildQuoteSchedules(
                scheduledForUnix,
                quoteEntries,
                signedEvent as SignedEventLike,
                tagArray,
                setSigningError
              );
              if (quoteSchedules == null) return false;
              if (quoteSchedules.length > 0) {
                p["quoteSchedules"] = JSON.stringify(quoteSchedules);
              }
            }
            return true;
          }
          const payloadComplete = await addRepostAndQuoteToPayload(payload);
          if (!payloadComplete) return;

          if (embedContext) payload["_embedContext"] = embedContext;
          setLastPublishFailed(false);
          setPublishSubmitInFlight(true);
          fetcher.submit(payload, fetcherSubmitOptions);
        } catch (error) {
          if (
            generation != null &&
            generation !== submitGenerationRef.current
          ) {
            return;
          }
          const { handleAsyncError } =
            await import("~/lib/error-handler.client");
          handleAsyncError(
            error,
            {
              component: "UnifiedComposer",
              action: "handleSubmit",
            },
            false
          );
          setSigningError(
            error instanceof Error
              ? error.message
              : "Failed to sign post. Please try again."
          );
        } finally {
          if (
            generation != null &&
            generation === submitGenerationRef.current
          ) {
            lastSubmitForRetryRef.current = null;
            setIsSigning(false);
          }
        }
      }

      if (
        isThreadMode &&
        (submitType === ACTION_POST_TEXT || submitType === ACTION_SCHEDULE_TEXT)
      ) {
        await runThreadSubmit();
        return;
      }
      await runSinglePostSubmit();
    },
    [
      form,
      fetcher,
      setPublishSubmitInFlight,
      setLastPublishFailed,
      isTemplateMode,
      templateName,
      editTemplateContext,
      clearLocalSnapshot,
      attachments,
      selectedHashtags,
      selectedQueue,
      queueTypeId,
      queueTypes,
      initialDraftId,
      relayOverride,
      scheduleRandomWindowMinutes,
      alsoScheduleRepost,
      repostDelayList,
      repostConditions,
      alsoScheduleQuote,
      quoteEntries,
      isThreadMode,
      threadSegments,
      threadDelayMinutes,
      user,
      defaultTags,
      fetcherSubmitOptions,
      embedContext,
      publishMode,
      calculateQueueScheduleTime,
      onBeginSaveDraft,
    ]
  );

  const clearSigningState = React.useCallback(() => {
    setSigningError(null);
    setIsSigning(false);
    setPartialThreadState(null);
  }, []);

  /** Clears pending auto-retry ref (e.g. user cancelled or reconnect without resubmit). */
  const cancelSigningState = React.useCallback(() => {
    submitGenerationRef.current += 1;
    lastSubmitForRetryRef.current = null;
    clearSigningState();
  }, [clearSigningState]);

  const retryLastSubmit = React.useCallback((): boolean => {
    const pending = lastSubmitForRetryRef.current;
    if (!pending) return false;
    lastSubmitForRetryRef.current = null;
    void runSubmit(pending.data, pending.event);
    return true;
  }, [runSubmit]);

  const submitThreadSuccessfulOnly = React.useCallback(async () => {
    const state = partialThreadState;
    if (!state || state.signedEvents.length === 0) {
      setPartialThreadState(null);
      return;
    }
    const segmentsToSubmit = threadSegments.slice(0, state.signedEvents.length);
    const threadPayload = new FormData();
    threadPayload.set(
      "_action",
      state.submitType === ACTION_POST_TEXT ? "post-thread" : "schedule-thread"
    );
    threadPayload.set(
      "threadSegments",
      JSON.stringify(
        segmentsToSubmit.map((s) => ({
          content: s.content,
          attachmentMeta: s.attachments
            .filter((a) => a.url)
            .map((a) => ({
              localId: a.localId,
              url: a.url,
              alt: a.alt,
            })),
        }))
      )
    );
    threadPayload.set("threadSignedEvents", JSON.stringify(state.signedEvents));
    threadPayload.set("threadDelaySeconds", String(threadDelayMinutes * 60));
    threadPayload.set("queueType", state.data.queueType);
    if (queueTypeId) threadPayload.set("queueTypeId", queueTypeId);
    if (state.data.hashTagPresetId)
      threadPayload.set("hashTagPresetId", state.data.hashTagPresetId);
    if (state.submitType === ACTION_SCHEDULE_TEXT && state.signedEvents[0]) {
      const actualFirst = state.signedEvents[0].created_at;
      if (actualFirst >= Math.floor(Date.now() / 1000)) {
        threadPayload.set("scheduledFor", String(actualFirst));
        const tz = user?.timezone ?? "UTC";
        if (state.data.scheduledFor?.trim()) {
          const nominalUnix = Math.floor(
            (await parseScheduledTime(state.data.scheduledFor, tz)) / 1000
          );
          if (Number.isFinite(nominalUnix) && nominalUnix !== actualFirst) {
            threadPayload.set("nominalScheduledFor", String(nominalUnix));
          }
        }
      }
    }
    if (relayOverride && relayOverride.length > 0)
      threadPayload.set("relays", JSON.stringify(relayOverride));
    if (embedContext) threadPayload.set("_embedContext", embedContext);
    threadPayload.set(
      "includeHashtagsInNoteBody",
      String(Boolean(state.data.includeHashtagsInNoteBody))
    );
    setPartialThreadState(null);
    setLastPublishFailed(false);
    setPublishSubmitInFlight(true);
    fetcher.submit(threadPayload, fetcherSubmitOptions);
  }, [
    partialThreadState,
    threadSegments,
    threadDelayMinutes,
    queueTypeId,
    user?.timezone,
    relayOverride,
    fetcher,
    fetcherSubmitOptions,
    embedContext,
    setLastPublishFailed,
    setPublishSubmitInFlight,
  ]);

  const retryThreadFailed = React.useCallback(() => {
    const state = partialThreadState;
    if (!state) return;
    setPartialThreadState(null);
    void runSubmit(state.data);
  }, [partialThreadState, runSubmit]);

  return {
    runSubmit,
    isSigning,
    signingError,
    setSigningError,
    clearSigningState,
    cancelSigningState,
    retryLastSubmit,
    partialThreadState,
    submitThreadSuccessfulOnly,
    retryThreadFailed,
  };
}
