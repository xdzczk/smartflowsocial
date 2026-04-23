/**
 * Composer submit/schedule orchestration: build payload, call actions, handle loading and errors.
 */

import * as React from "react";

import {
  createSubmissionId,
  pendingPublish,
} from "~/features/auth/signing/signing-attempts.client";
import type { SignedEvent } from "~/features/nostr/types";
import { buildThreadSubmitFormData } from "~/features/posts/composer/composer-submit/build-thread-submit-form-data";
import { signThreadSegmentsWithRetry } from "~/features/posts/composer/composer-submit/sign-thread-segments";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { applyRandomScheduleWindow } from "~/lib/schedule-random";
import { nowMillis } from "~/lib/temporal";

import {
  appendMediaUrlsForSigning,
  stripAttachmentTokens,
} from "../../utils/inline-tokens";
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
import {
  appendRelayOverride,
  appendSubmissionId,
} from "../services/build-publish-formdata.client";

import type {
  TextPostFormData,
  ThreadSegment,
  UseComposerSubmitOptions,
} from "./composer-submit-types";

export type { TextPostFormData, ThreadSegment, UseComposerSubmitOptions };
const ACTION_UPDATE_SCHEDULED = "update-scheduled";
const ACTION_UPDATE_FOLLOW_UP = "update-follow-up";

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
    initialAttachmentMeta = [],
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
    onPublishIntent,
    composerContext = { mode: "create" },
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

  // Stale-attempt cancellation now lives entirely in `pendingPublish`. We
  // staleness-check by asking the store whether the attempt id we started
  // with is still the current one; on `pendingPublish.cancel()` (or a fresh
  // `start()` overwriting us) the snapshot id changes and the in-flight
  // sign aborts cleanly without ever calling `fetcher.submit`.
  const isAttemptStale = React.useCallback((attemptId: string): boolean => {
    return pendingPublish.getSnapshot()?.id !== attemptId;
  }, []);

  const appendComposerContextFormData = React.useCallback(
    (target: FormData | Record<string, string>) => {
      if (composerContext.mode === "create") return;
      if (target instanceof FormData) {
        target.set("composerMode", composerContext.mode);
      } else {
        target["composerMode"] = composerContext.mode;
      }
      if (composerContext.mode === "edit_draft") {
        if (target instanceof FormData)
          target.set("draftId", composerContext.draftId);
        else target["draftId"] = composerContext.draftId;
      } else if (composerContext.mode === "edit_scheduled") {
        if (target instanceof FormData)
          target.set("scheduledActionId", composerContext.scheduledActionId);
        else target["scheduledActionId"] = composerContext.scheduledActionId;
      } else {
        if (target instanceof FormData)
          target.set("followUpActionId", composerContext.followUpActionId);
        else target["followUpActionId"] = composerContext.followUpActionId;
        if (composerContext.parentActionId) {
          if (target instanceof FormData)
            target.set("parentActionId", composerContext.parentActionId);
          else target["parentActionId"] = composerContext.parentActionId;
        }
      }
    },
    [composerContext]
  );

  const buildAttachmentMetaForSubmit = React.useCallback(
    () =>
      attachments
        .filter((a) => a.url)
        .map((a) => ({ localId: a.localId, url: a.url as string, alt: a.alt })),
    [attachments]
  );

  const buildAttachmentDiffJson = React.useCallback(() => {
    if (composerContext.mode === "create") return null;
    const previousByLocalId = new Map(
      initialAttachmentMeta.map((entry) => [entry.localId, entry])
    );
    const current = buildAttachmentMetaForSubmit();
    const currentIds = new Set(current.map((entry) => entry.localId));
    const removed = initialAttachmentMeta
      .filter((entry) => !currentIds.has(entry.localId))
      .map((entry) => ({ ...entry, source: "existing" as const }));
    const retained = current
      .filter((entry) => previousByLocalId.has(entry.localId))
      .map((entry) => ({ ...entry, source: "existing" as const }));
    const added = current
      .filter((entry) => !previousByLocalId.has(entry.localId))
      .map((entry) => ({ ...entry, source: "new" as const }));
    return JSON.stringify({ removed, retained, added });
  }, [
    buildAttachmentMetaForSubmit,
    composerContext.mode,
    initialAttachmentMeta,
  ]);

  const runSubmit = React.useCallback(
    async (data: TextPostFormData, event?: React.BaseSyntheticEvent) => {
      // The active submissionId is owned by the pending-publish store and
      // adopted in `dispatch` below. We seed it here only as a defensive
      // default so the inner builders that close over it never see an
      // uninitialised string before `pendingPublish.start` calls back.
      let submissionId = createSubmissionId();
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
        formData.set(
          "_action",
          composerContext.mode === "edit_draft" ? "update-draft" : "save-draft"
        );
        formData.set("content", data.content);
        formData.set("queueType", data.queueType);
        if (queueTypeId) formData.set("queueTypeId", queueTypeId);
        if (data.scheduledFor) formData.set("scheduledFor", data.scheduledFor);
        formData.set("tags", selectedHashtags);
        if (data.hashTagPresetId)
          formData.set("hashTagPresetId", data.hashTagPresetId);
        if (initialDraftId) formData.set("draftId", initialDraftId);
        appendRelayOverride(formData, relayOverride);
        const draftAttachmentMeta = buildAttachmentMetaForSubmit();
        if (draftAttachmentMeta.length > 0) {
          formData.set("attachmentMeta", JSON.stringify(draftAttachmentMeta));
        }
        const attachmentDiff = buildAttachmentDiffJson();
        if (attachmentDiff) {
          formData.set("attachmentDiff", attachmentDiff);
        }
        formData.set(
          "includeHashtagsInNoteBody",
          String(Boolean(data.includeHashtagsInNoteBody))
        );
        if (embedContext) formData.set("_embedContext", embedContext);
        appendComposerContextFormData(formData);
        fetcher.submit(formData, fetcherSubmitOptions);
      }

      if (isTemplateMode && submitType === "save-as-template") {
        submitTemplateSave();
        return;
      }
      // Rail uses `value="save-draft"`; legacy buttons may use `draft-text`. Both skip signing.
      if (
        submitType === "draft-text" ||
        submitType === "save-draft" ||
        submitType === "update-draft"
      ) {
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
          const isUpdateScheduleAction =
            submitType === ACTION_UPDATE_SCHEDULED ||
            submitType === ACTION_UPDATE_FOLLOW_UP;
          if (
            (submitType === ACTION_SCHEDULE_TEXT || isUpdateScheduleAction) &&
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
            (submitType === ACTION_SCHEDULE_TEXT || isUpdateScheduleAction) &&
            nominalThreadBase * 1000 < Date.now()
          ) {
            setSigningError(COMPOSER_SCHEDULE_FUTURE);
            return;
          }
          const threadRandomMinutes = scheduleRandomWindowMinutes;
          const threadSignBase =
            (submitType === ACTION_SCHEDULE_TEXT || isUpdateScheduleAction) &&
            threadRandomMinutes > 0
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
          // Cancellation guard: if the user discarded this attempt or a
          // fresher publish click overrode it while the bunker was busy,
          // bail out before we mutate UI state or hit the fetcher.
          if (isAttemptStale(submissionId)) {
            return;
          }
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
              submitType === ACTION_SCHEDULE_TEXT ||
              submitType === ACTION_UPDATE_SCHEDULED ||
              submitType === ACTION_UPDATE_FOLLOW_UP
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
          appendComposerContextFormData(threadPayload);
          appendSubmissionId(threadPayload, submissionId);

          setLastPublishFailed(false);
          setPublishSubmitInFlight(true);
          fetcher.submit(threadPayload, fetcherSubmitOptions);
        } catch (err) {
          // The pending-publish state machine owns whether this is a
          // resumable signer-unavailable error or a terminal failure;
          // we just clear the local UI flag and re-throw so the store can
          // classify and transition.
          if (!isAttemptStale(submissionId)) {
            setIsSigning(false);
          } else {
            // Stale attempts must not surface their late errors as a UI
            // banner — the user already moved on.
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
          throw err;
        }
      }

      function getSinglePostValidationError(): string | null {
        if (attachments.some((a) => a.status === "uploading"))
          return COMPOSER_UPLOAD_WAIT;
        if (attachments.some((a) => a.status === "failed"))
          return COMPOSER_REMOVE_FAILED_ATTACHMENTS;
        const hasText = data.content.trim().length > 0;
        const hasResolvedMedia = attachments.some((a) => Boolean(a.url));
        if (!hasText && !hasResolvedMedia) return COMPOSER_CONTENT_REQUIRED;
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
          const isUpdateScheduleAction =
            submitType === ACTION_UPDATE_SCHEDULED ||
            submitType === ACTION_UPDATE_FOLLOW_UP;
          if (
            (submitType === ACTION_SCHEDULE_TEXT || isUpdateScheduleAction) &&
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
          const isSchedule =
            submitType === ACTION_SCHEDULE_TEXT || isUpdateScheduleAction;
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

          const contentResolvedForSign = stripAttachmentTokens(
            data.content
          ).trim();
          const appendTagsSingle = data.includeHashtagsInNoteBody !== false;
          const bodyWithOptionalTags = appendTagsSingle
            ? `${contentResolvedForSign}\n${effectiveHashtags}`
            : contentResolvedForSign;
          const mediaUrlsForSign = attachments
            .filter((a): a is typeof a & { url: string } => Boolean(a.url))
            .map((a) => a.url);
          const contentToSign = appendMediaUrlsForSigning(
            bodyWithOptionalTags,
            mediaUrlsForSign
          );

          setIsSigning(true);
          const { nostrEvent, signedEvent } = await nostrAdapter.signEvent(
            {
              content: contentToSign,
              created_at: scheduledForUnix,
              kind: 1,
              tags: tagArray,
            },
            { clearCacheOnError: false }
          );
          // Cancellation guard: see runThreadSubmit. The pending-publish
          // store is the source of truth for "is this attempt still live?"
          if (isAttemptStale(submissionId)) {
            return;
          }
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
          appendRelayOverride(payload, relayOverride);
          appendSubmissionId(payload, submissionId);
          const attachmentMeta = buildAttachmentMetaForSubmit();
          if (attachmentMeta.length > 0) {
            payload["attachmentMeta"] = JSON.stringify(attachmentMeta);
          }
          const attachmentDiff = buildAttachmentDiffJson();
          if (attachmentDiff) {
            payload["attachmentDiff"] = attachmentDiff;
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
          appendComposerContextFormData(payload);
          setLastPublishFailed(false);
          setPublishSubmitInFlight(true);
          fetcher.submit(payload, fetcherSubmitOptions);
        } catch (error) {
          if (isAttemptStale(submissionId)) {
            // Stale attempts must not surface their late errors as a UI
            // banner — the user already moved on.
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
          throw error;
        } finally {
          if (!isAttemptStale(submissionId)) {
            setIsSigning(false);
          }
        }
      }

      const dispatch = async (storeSubmissionId: string): Promise<void> => {
        // Adopt the store-managed submissionId so the same id is embedded
        // in both the original payload and any resume-driven re-submit.
        submissionId = storeSubmissionId;
        if (
          isThreadMode &&
          (submitType === ACTION_POST_TEXT ||
            submitType === ACTION_SCHEDULE_TEXT ||
            submitType === ACTION_UPDATE_SCHEDULED ||
            submitType === ACTION_UPDATE_FOLLOW_UP)
        ) {
          await runThreadSubmit();
          return;
        }
        await runSinglePostSubmit();
      };

      // Signal publish intent immediately so the parent can open progress UI
      // before any async signing or network work begins.
      if (submitType === ACTION_POST_TEXT) {
        onPublishIntent?.();
      }

      // Single entry point: every publish click — fresh or partial-thread
      // retry — hands off to the signing-attempts state machine. The store
      // owns the resumable-attempt lifecycle (awaiting_signer / resuming /
      // expired) and re-invokes `dispatch` on `nostr-connection-healthy`
      // with the same submissionId so the server-side
      // creationIdempotencyKey collapses both attempts onto one Post row.
      //
      // intent.idempotencyKey reuses `submissionId` so the server-side
      // `/api/publish` once-only guard collapses every resume of this
      // attempt onto a single side-effect run — same key the route
      // already feeds into the publish-attempt-dedupe utility.
      pendingPublish.start({
        performSignAndSubmit: dispatch,
        intent: {
          kind: "durable",
          name: "composer_publish",
          idempotencyKey: submissionId,
          label: "Publish",
        },
        surface: "composer",
      });
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
      onPublishIntent,
      appendComposerContextFormData,
      buildAttachmentMetaForSubmit,
      buildAttachmentDiffJson,
      composerContext.mode,
      isAttemptStale,
    ]
  );

  const clearSigningState = React.useCallback(() => {
    setSigningError(null);
    setIsSigning(false);
    setPartialThreadState(null);
  }, []);

  /**
   * User-initiated cancel: tear down the in-flight pending-publish attempt
   * (so a late `nostr-connection-healthy` event can't autocomplete a
   * publish the user has discarded) and clear the local UI banner.
   */
  const cancelSigningState = React.useCallback(() => {
    pendingPublish.cancel();
    clearSigningState();
  }, [clearSigningState]);

  /**
   * Adapter for `useComposerSignerReconnect.onHealthyWhileSigning`. Returns
   * true iff the pending-publish store actually started a resume — in
   * which case the reconnect hook skips its `clearSigningState` fallback.
   * No legacy ref-based retry remains; the state machine is now the
   * single source of truth for "is there a publish click to autocomplete?"
   */
  const retryLastSubmit = React.useCallback((): boolean => {
    return pendingPublish.maybeResume();
  }, []);

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
    appendRelayOverride(threadPayload, relayOverride);
    if (embedContext) threadPayload.set("_embedContext", embedContext);
    appendComposerContextFormData(threadPayload);
    threadPayload.set(
      "includeHashtagsInNoteBody",
      String(Boolean(state.data.includeHashtagsInNoteBody))
    );
    // Partial-thread retry is a fresh user-initiated attempt (after they chose
    // to submit only the successfully-signed segments), so mint a new
    // submissionId rather than reusing the original thread's id.
    appendSubmissionId(threadPayload, createSubmissionId());
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
    appendComposerContextFormData,
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
