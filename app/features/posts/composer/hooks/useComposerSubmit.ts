/**
 * Composer submit/schedule orchestration: build payload, call actions, handle loading and errors.
 */

import type { FetcherWithComponents } from "@remix-run/react";
import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import type { SignedEvent } from "~/features/nostr/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { applyRandomScheduleWindow } from "~/lib/schedule-random";
import { nowMillis } from "~/lib/temporal";
import type { textPostClientSchema } from "~/lib/validation";

import type {
  QueueType,
  ComposerAttachment,
  RepostConditions,
} from "../../types";
import { resolveContentForSigning } from "../../utils/inline-tokens.client";
import { getThreadReplyTags } from "../../utils/repost-quote-events.client";
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
  COMPOSER_UPLOAD_WAIT,
  COMPOSER_REMOVE_FAILED_ATTACHMENTS,
} from "../components/composer/composer-validation";

export type TextPostFormData = z.infer<typeof textPostClientSchema>;

export interface ThreadSegment {
  id: string;
  content: string;
  attachments: ComposerAttachment[];
}

export interface UseComposerSubmitOptions {
  form: UseFormReturn<TextPostFormData>;
  fetcher: FetcherWithComponents<unknown>;
  setPublishSubmitInFlight: (v: boolean) => void;
  setLastPublishFailed: (v: boolean) => void;
  /** Template mode: save-as-template flow */
  isTemplateMode: boolean;
  templateName: string;
  editTemplateContext: { templateId: string; postId: string } | null;
  clearLocalSnapshot: () => void;
  attachments: ComposerAttachment[];
  selectedHashtags: string;
  selectedQueue: string;
  queueTypeId: string | null;
  queueTypes: Array<string | QueueType>;
  initialDraftId: string | null;
  relayOverride?: string[];
  scheduleRandomWindowMinutes: number;
  alsoScheduleRepost: boolean;
  repostDelayList: Array<{
    id: string;
    value: number;
    unit: "hours" | "minutes";
  }>;
  repostConditions: RepostConditions | null;
  alsoScheduleQuote: boolean;
  quoteEntries: Array<{
    id: string;
    value: number;
    unit: "hours" | "minutes";
    caption: string;
  }>;
  isThreadMode: boolean;
  threadSegments: ThreadSegment[];
  threadDelayMinutes: number;
  user: {
    id?: string;
    timezone?: string;
    showHashTagsinPosts?: boolean;
  } | null;
  defaultTags?: string[];
}

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
  } = options;

  const [isSigning, setIsSigning] = React.useState(false);
  const [signingError, setSigningError] = React.useState<string | null>(null);
  const lastSubmitForRetryRef = React.useRef<{
    data: TextPostFormData;
    event: React.BaseSyntheticEvent | undefined;
  } | null>(null);

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
        const draftAttachmentMeta = attachments
          .filter((a) => a.url)
          .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt }));
        if (draftAttachmentMeta.length > 0) {
          formData.set("attachmentMeta", JSON.stringify(draftAttachmentMeta));
        }
        fetcher.submit(formData, { method: "post" });
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
        fetcher.submit(formData, { method: "post" });
      }

      if (isTemplateMode && submitType === "save-as-template") {
        submitTemplateSave();
        return;
      }
      if (submitType === "draft-text") {
        submitDraftSave();
        return;
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
          const userTimezone = user?.timezone ?? "UTC";
          const baseTime =
            submitType === ACTION_POST_TEXT
              ? Math.floor(Date.now() / 1000)
              : Math.floor(
                  (await parseScheduledTime(
                    data.scheduledFor ?? "",
                    userTimezone
                  )) / 1000
                );
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

          lastSubmitForRetryRef.current = { data, event };
          setIsSigning(true);
          const signedEvents: SignedEvent[] = [];
          let rootEventId: string | null = null;
          let previousEventId: string | null = null;
          for (let i = 0; i < threadSegments.length; i++) {
            const seg = threadSegments[i];
            if (!seg) continue;
            const withUrl = seg.attachments.filter((a) => a.url);
            const contentToSign = resolveContentForSigning(
              seg.content,
              withUrl
            );
            const contentWithTags = user?.showHashTagsinPosts
              ? `${contentToSign}\n${effectiveHashtags}`
              : contentToSign;
            const created_at = baseTime + i * threadDelayMinutes * 60;
            const tags =
              i === 0
                ? tagArray
                : [
                    ...getThreadReplyTags(previousEventId!, rootEventId!),
                    ...tagArray,
                  ];
            const { signedEvent } = await nostrAdapter.signEvent({
              content: contentWithTags,
              created_at,
              kind: 1,
              tags,
            });
            signedEvents.push(signedEvent);
            if (i === 0) rootEventId = signedEvent.id;
            previousEventId = signedEvent.id;
          }
          lastSubmitForRetryRef.current = null;
          setIsSigning(false);

          const threadPayload: FormData = new FormData();
          threadPayload.set(
            "_action",
            submitType === ACTION_POST_TEXT ? "post-thread" : "schedule-thread"
          );
          threadPayload.set(
            "threadSegments",
            JSON.stringify(
              threadSegments.map((s) => ({
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
          threadPayload.set("threadSignedEvents", JSON.stringify(signedEvents));
          threadPayload.set(
            "threadDelaySeconds",
            String(threadDelayMinutes * 60)
          );
          threadPayload.set("queueType", data.queueType);
          if (queueTypeId) threadPayload.set("queueTypeId", queueTypeId);
          if (data.hashTagPresetId)
            threadPayload.set("hashTagPresetId", data.hashTagPresetId);
          if (submitType === ACTION_SCHEDULE_TEXT && data.scheduledFor) {
            const unix = Math.floor(
              (await parseScheduledTime(
                data.scheduledFor,
                user?.timezone ?? "UTC"
              )) / 1000
            );
            if (unix < Math.floor(Date.now() / 1000)) {
              setSigningError(COMPOSER_SCHEDULE_FUTURE);
              return;
            }
            threadPayload.set("scheduledFor", String(unix));
          }
          if (relayOverride && relayOverride.length > 0)
            threadPayload.set("relays", JSON.stringify(relayOverride));

          setLastPublishFailed(false);
          setPublishSubmitInFlight(true);
          fetcher.submit(threadPayload, { method: "post" });
        } catch (err) {
          lastSubmitForRetryRef.current = null;
          setIsSigning(false);
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

      async function runSinglePostSubmit(): Promise<void> {
        try {
          setSigningError(null);
          const validationError = getSinglePostValidationError();
          if (validationError) {
            setSigningError(validationError);
            if (validationError === COMPOSER_CONTENT_REQUIRED) {
              form.setError("content", {
                type: "manual",
                message: COMPOSER_CONTENT_REQUIRED,
              });
            }
            return;
          }
          const userTimezone = user?.timezone ?? "UTC";
          const scheduledTime =
            submitType === ACTION_POST_TEXT
              ? nowMillis()
              : await parseScheduledTime(data.scheduledFor ?? "", userTimezone);
          const nominalUnix = Math.floor(scheduledTime / 1000);
          const isSchedule = submitType === ACTION_SCHEDULE_TEXT;
          if (isSchedule && nominalUnix * 1000 < Date.now()) {
            setSigningError(COMPOSER_SCHEDULE_FUTURE);
            return;
          }
          const scheduledForUnix =
            isSchedule && scheduleRandomWindowMinutes > 0
              ? applyRandomScheduleWindow(
                  nominalUnix,
                  scheduleRandomWindowMinutes
                )
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
          const contentToSign = user?.showHashTagsinPosts
            ? `${contentResolvedForSign}\n${effectiveHashtags}`
            : contentResolvedForSign;

          lastSubmitForRetryRef.current = { data, event };
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/cc3d078c-137d-4ccf-99b5-4344a69d09db",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "995736",
              },
              body: JSON.stringify({
                sessionId: "995736",
                location:
                  "useComposerSubmit.ts:runSinglePostSubmit:setSigningTrue",
                message: "setIsSigning(true) single post",
                data: {},
                timestamp: Date.now(),
                hypothesisId: "H3",
              }),
            }
          ).catch(() => {});
          // #endregion
          setIsSigning(true);
          const { nostrEvent, signedEvent } = await nostrAdapter.signEvent({
            content: contentToSign,
            created_at: scheduledForUnix,
            kind: 1,
            tags: tagArray,
          });
          lastSubmitForRetryRef.current = null;
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/cc3d078c-137d-4ccf-99b5-4344a69d09db",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "995736",
              },
              body: JSON.stringify({
                sessionId: "995736",
                location:
                  "useComposerSubmit.ts:runSinglePostSubmit:setSigningFalseSuccess",
                message: "setIsSigning(false) after sign success",
                data: {},
                timestamp: Date.now(),
                hypothesisId: "H3",
              }),
            }
          ).catch(() => {});
          // #endregion
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
            scheduleRandomWindowMinutes > 0
          ) {
            payload["nominalScheduledFor"] = String(nominalUnix);
          }
          if (data["isRecyclable"]) payload["isRecyclable"] = "on";
          if (data["useHashtagPresets"] && data["hashTagPresetId"]) {
            payload["hashTagPresetId"] = data["hashTagPresetId"];
            payload["useHashtagPresets"] = "on";
          }
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

          setLastPublishFailed(false);
          setPublishSubmitInFlight(true);
          fetcher.submit(payload, { method: "post" });
        } catch (error) {
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
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/cc3d078c-137d-4ccf-99b5-4344a69d09db",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "995736",
              },
              body: JSON.stringify({
                sessionId: "995736",
                location: "useComposerSubmit.ts:runSinglePostSubmit:finally",
                message: "runSinglePostSubmit finally, setIsSigning(false)",
                data: {},
                timestamp: Date.now(),
                hypothesisId: "H3",
              }),
            }
          ).catch(() => {});
          // #endregion
          lastSubmitForRetryRef.current = null;
          setIsSigning(false);
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
    ]
  );

  const clearSigningState = React.useCallback(() => {
    lastSubmitForRetryRef.current = null;
    setSigningError(null);
    setIsSigning(false);
  }, []);

  const retryLastSubmit = React.useCallback(() => {
    const pending = lastSubmitForRetryRef.current;
    if (!pending) return;
    lastSubmitForRetryRef.current = null;
    void runSubmit(pending.data, pending.event);
  }, [runSubmit]);

  return {
    runSubmit,
    isSigning,
    signingError,
    setSigningError,
    clearSigningState,
    retryLastSubmit,
  };
}
