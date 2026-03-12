/**
 * Unified composer: one surface for text + optional attachments.
 * Replaces Text/Media tabs with a single note editor and attachments strip.
 * Layout + composition of composer subcomponents and hooks.
 */

import { useFetcher, useNavigate } from "@remix-run/react";
import React, { useEffect, useRef } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ConfidencePanel } from "~/features/posts/components/ConfidencePanel";
import type { ComposerStatus } from "~/features/posts/components/NewPostHeader";
import { TagsChipRow } from "~/features/posts/components/TagsChipRow";
import { DraftPickerModal } from "~/features/posts/drafts";
import { usePostScheduling } from "~/features/posts/scheduling";
import { uploadMany as uploadMultipleFiles } from "~/features/upload/media.client";
import { getClientDisplayErrorMessage } from "~/lib/error-handler.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { textPostClientSchema } from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

import type { QueueType, ComposerAttachment } from "../../types";
import { appendToken, removeToken } from "../../utils/inline-tokens.client";
import {
  useComposerLocalDraft,
  type ComposerLocalSnapshot,
} from "../hooks/useComposerLocalDraft";
import { useComposerSignerReconnect } from "../hooks/useComposerSignerReconnect";
import { useComposerState } from "../hooks/useComposerState";
import { useComposerSubmit } from "../hooks/useComposerSubmit";
import { useUnifiedComposerState } from "../hooks/useUnifiedComposerState";

import {
  ComposerActionButtons,
  ComposerErrors,
  ComposerQueueField,
  ComposerScheduleField,
} from "./composer";
import {
  ACCEPTED_MEDIA_TYPES,
  filterMediaFiles,
  getQueueNextSlotLabel,
  getRelativeTime,
  getScheduleTimeLabel,
  getSummaryLine,
} from "./composer/composer-helpers";
import { UnifiedComposerContentSection } from "./composer/unified-composer-sections";

export interface UnifiedComposerProps {
  queueTypes?: Array<string | QueueType>;
  hashTagPresets?: Array<{ id: string; name: string; tags: string }>;
  onQueueTypeChange?: (queueType: string) => void;
  selectedHashTagPresetId?: string | null | undefined;
  onHashtagPresetChange?: (presetId: string | null, hashtags: string) => void;
  /** Optional relay override (from composer relay selector). When non-empty, sent with submit. */
  relayOverride?: string[];
  /** Relay count to show in confidence panel (default list or override). */
  relayCount?: number;
  /** Called when composer status changes (for header status pill). */
  onComposerStatusChange?: (status: ComposerStatus) => void;
  /** When opening an existing draft from URL, pass its id so "Save as Draft" updates this draft. */
  initialDraftId?: string | null;
  /** Draft data to prefill the composer (when opening from drafts). Requires initialDraftId. */
  /** When "template", only "Save as template" and Cancel are shown; no Schedule/Publish/Save as draft. */
  mode?: "default" | "template";
  /** When set with mode="template", submit uses updateTemplatePost instead of createTemplate. */
  editTemplateContext?: { templateId: string; postId: string } | null;
  /** When editing a template, pass the current template name to prefill the composer field. */
  initialTemplateName?: string | null;
  initialDraft?: {
    content: string;
    caption: string;
    fileUrl: string[];
    queueType: string;
    queueTypeId: string | null;
    tags: string;
    draftMeta: {
      attachmentMeta?: Array<{ localId: string; url: string; alt?: string }>;
    } | null;
    hashTagPresetId: string | null;
  } | null;
  /** Prefill schedule (datetime-local format YYYY-MM-DDTHH:mm) when opening from calendar slot. */
  initialScheduledFor?: string | null;
  /** When true, skip restoring local browser draft and clear any cached snapshot. */
  skipLocalDraftRestore?: boolean;
  /** Schedule intervals from route loader (e.g. new post). Used when user is not yet available so time chips show on first paint. */
  scheduleIntervals?: number[];
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- composer has many branches by design */
export function UnifiedComposer({
  queueTypes = [],
  hashTagPresets = [],
  onQueueTypeChange,
  selectedHashTagPresetId,
  onHashtagPresetChange,
  relayOverride,
  relayCount: relayCountProp = 0,
  onComposerStatusChange,
  initialDraftId = null,
  initialDraft = null,
  initialScheduledFor = null,
  skipLocalDraftRestore = false,
  mode = "default",
  editTemplateContext = null,
  initialTemplateName = null,
  scheduleIntervals: scheduleIntervalsProp,
}: UnifiedComposerProps) {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const user = useOptionalUser();
  const isTemplateMode = mode === "template";
  const initialAttachmentsFromDraft = React.useMemo(() => {
    const meta = initialDraft?.draftMeta?.attachmentMeta;
    if (!meta?.length) return [];
    return meta.map((a) => ({
      localId: a.localId,
      url: a.url,
      status: "done" as const,
      alt: a.alt,
    }));
  }, [initialDraft?.draftMeta?.attachmentMeta]);

  const composerState = useUnifiedComposerState({
    initialTags: initialDraft?.tags ?? "",
    initialTemplateName: initialTemplateName ?? "",
    initialAttachments: initialAttachmentsFromDraft,
  });
  const {
    draftPickerOpen,
    setDraftPickerOpen,
    publishSubmitInFlight,
    setPublishSubmitInFlight,
    lastPublishFailed,
    setLastPublishFailed,
    signerLabel,
    signerReady,
    selectedHashtags,
    setSelectedHashtags,
    templateName,
    setTemplateName,
    attachments,
    setAttachments,
    fileInputRef,
    alsoScheduleRepost,
    setAlsoScheduleRepost,
    repostDelayList,
    setRepostDelayList,
    repostConditions,
    setRepostConditions,
    alsoScheduleQuote,
    setAlsoScheduleQuote,
    quoteEntries,
    setQuoteEntries,
    postOptionsOpen,
    setPostOptionsOpen,
    scheduleRandomWindowMinutes,
    setScheduleRandomWindowMinutes,
    isThreadMode,
    setIsThreadMode,
    threadSegments,
    setThreadSegments,
    threadDelayMinutes,
    setThreadDelayMinutes,
    draggingOverSegmentId,
    setDraggingOverSegmentId,
  } = composerState;

  const tags: string[] = [];

  const form = useZodForm(textPostClientSchema, {
    defaultValues: {
      content: initialDraft?.content ?? "",
      scheduledFor: initialScheduledFor ?? "",
      queueType: initialDraft?.queueType ?? "unassigned",
      isRecyclable: false,
      useHashtagPresets: !!initialDraft?.hashTagPresetId,
      hashTagPresetId:
        initialDraft?.hashTagPresetId ?? selectedHashTagPresetId ?? undefined,
    },
  });

  const content = form.watch("content");
  const formSelectedHashtagPresetId = form.watch("hashTagPresetId");

  const {
    selectedQueue,
    setSelectedQueue,
    scheduledFor: schedulingScheduledFor,
    setScheduledFor: setSchedulingScheduledFor,
    calculateQueueScheduleTime,
    handleScheduleIntervalClick,
    scheduleIntervals,
  } = usePostScheduling({
    queueTypes,
    scheduleIntervals:
      scheduleIntervalsProp ?? (user?.scheduleInterval as number[] | undefined),
    userTimezone: user?.timezone ?? undefined,
    initialQueue: initialDraft?.queueType ?? "unassigned",
    onQueueTypeChange,
  });

  React.useEffect(() => {
    const qt = queueTypes.find(
      (q) => (typeof q === "string" ? q : q.name) === selectedQueue
    );
    const window =
      typeof qt === "object" &&
      qt.scheduleConfig &&
      typeof qt.scheduleConfig === "object" &&
      "scheduleRandomWindowMinutes" in qt.scheduleConfig
        ? ((qt.scheduleConfig as { scheduleRandomWindowMinutes?: number })
            .scheduleRandomWindowMinutes ?? 0)
        : 0;
    setScheduleRandomWindowMinutes(
      typeof window === "number" && window >= 0 && window <= 15 ? window : 0
    );
  }, [selectedQueue, queueTypes, setScheduleRandomWindowMinutes]);

  const {
    restored: localRestored,
    saveSnapshot: saveLocalSnapshot,
    flushSnapshot: flushLocalSnapshot,
    clearSnapshot: clearLocalSnapshot,
  } = useComposerLocalDraft(
    "composer-newpost-draft",
    !!initialDraftId || skipLocalDraftRestore
  );

  const lastLocalSnapshotRef = useRef<Omit<
    ComposerLocalSnapshot,
    "savedAt"
  > | null>(null);

  const appliedLocalRestoredRef = useRef(false);
  React.useEffect(() => {
    if (
      !localRestored ||
      initialDraftId ||
      skipLocalDraftRestore ||
      appliedLocalRestoredRef.current
    )
      return;
    appliedLocalRestoredRef.current = true;
    form.reset({
      content: localRestored.content,
      scheduledFor: localRestored.scheduledFor,
      queueType: localRestored.queueType,
      isRecyclable: false,
      useHashtagPresets: !!localRestored.hashTagPresetId,
      hashTagPresetId: localRestored.hashTagPresetId ?? undefined,
    });
    setSelectedHashtags(localRestored.tags);
    setAttachments(
      localRestored.attachmentMeta.map((a) => ({
        localId: a.localId,
        url: a.url,
        status: "done" as const,
        alt: a.alt,
      }))
    );
    setSelectedQueue(localRestored.queueType);
  }, [
    localRestored,
    initialDraftId,
    skipLocalDraftRestore,
    form,
    setSelectedQueue,
    setAttachments,
    setSelectedHashtags,
  ]);

  React.useEffect(() => {
    form.setValue("queueType", selectedQueue);
  }, [selectedQueue, form]);

  // Apply initial schedule from URL (e.g. from calendar empty-slot create)
  const appliedInitialScheduledRef = React.useRef(false);
  React.useEffect(() => {
    if (
      !initialScheduledFor ||
      initialDraftId ||
      appliedInitialScheduledRef.current
    )
      return;
    appliedInitialScheduledRef.current = true;
    setSchedulingScheduledFor(initialScheduledFor);
  }, [initialScheduledFor, initialDraftId, setSchedulingScheduledFor]);

  React.useEffect(() => {
    if (schedulingScheduledFor) {
      form.setValue("scheduledFor", schedulingScheduledFor);
    }
  }, [schedulingScheduledFor, form]);

  const formScheduledFor = form.watch("scheduledFor");
  const selectedQueueType = queueTypes.find(
    (q) => (typeof q === "string" ? q : q.name) === selectedQueue
  );
  const queueTypeId =
    typeof selectedQueueType === "object" ? selectedQueueType.id : null;

  // Persist to localStorage when not editing a server draft
  React.useEffect(() => {
    if (initialDraftId || skipLocalDraftRestore) return;
    const snapshot: Omit<ComposerLocalSnapshot, "savedAt"> = {
      content: content ?? "", // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- form state can be undefined
      queueType: selectedQueue,
      queueTypeId,

      scheduledFor: formScheduledFor ?? "",
      tags: selectedHashtags,
      hashTagPresetId: formSelectedHashtagPresetId ?? null,
      attachmentMeta: attachments
        .filter((a): a is typeof a & { url: string } => Boolean(a.url))
        .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt })),
    };
    lastLocalSnapshotRef.current = snapshot;
    saveLocalSnapshot(snapshot);
  }, [
    initialDraftId,
    skipLocalDraftRestore,
    content,
    selectedQueue,
    queueTypeId,
    formScheduledFor,
    selectedHashtags,
    formSelectedHashtagPresetId,
    attachments,
    saveLocalSnapshot,
  ]);

  // Flush localStorage on unmount and when page is hidden so content is not lost when navigating away
  React.useEffect(() => {
    if (initialDraftId || skipLocalDraftRestore) return;
    const flush = () => {
      const snap = lastLocalSnapshotRef.current;
      if (snap) flushLocalSnapshot(snap);
    };
    const onHide = () => flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [initialDraftId, skipLocalDraftRestore, flushLocalSnapshot]);

  const prevFormScheduledForRef = React.useRef(formScheduledFor);
  React.useEffect(() => {
    const formChanged = prevFormScheduledForRef.current !== formScheduledFor;
    prevFormScheduledForRef.current = formScheduledFor;
    if (
      formChanged &&
      formScheduledFor !== undefined &&
      formScheduledFor !== schedulingScheduledFor
    ) {
      setSchedulingScheduledFor(formScheduledFor);
    }
  }, [formScheduledFor, schedulingScheduledFor, setSchedulingScheduledFor]);

  const {
    runSubmit,
    isSigning,
    signingError,
    setSigningError,
    clearSigningState,
    retryLastSubmit,
  } = useComposerSubmit({
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
    user: user
      ? {
          id: user.id,
          timezone: user.timezone ?? undefined,
          showHashTagsinPosts: user.showHashTagsinPosts,
        }
      : null,
    defaultTags: tags,
  });

  useComposerSignerReconnect(clearSigningState, isSigning, retryLastSubmit);

  const handleSubmit = form.handleSubmit((data, event) => {
    void runSubmit(data, event);
  });

  const hasContent = isThreadMode
    ? threadSegments.some(
        (s) => s.content.trim() !== "" || s.attachments.length > 0
      )
    : (content?.trim() ?? "") !== "" || attachments.length > 0; // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- content from form.watch can be undefined
  const canSubmit = isThreadMode
    ? threadSegments.every(
        (s) =>
          !s.attachments.some(
            (a) => a.status === "uploading" || a.status === "failed"
          )
      )
    : !attachments.some(
        (a) => a.status === "uploading" || a.status === "failed"
      );
  const scheduleVal = formScheduledFor ?? schedulingScheduledFor;
  const hasScheduleTime =
    typeof scheduleVal === "string" ? scheduleVal.trim() !== "" : false;
  const composerStatus = useComposerState({
    hasContent,
    canSubmit,
    hasScheduleTime,
    isSigning,
    isSubmitting: fetcher.state !== "idle",
    publishSubmitInFlight,
    lastPublishFailed,
  });

  React.useEffect(() => {
    onComposerStatusChange?.(composerStatus);
  }, [composerStatus, onComposerStatusChange]);

  React.useEffect(() => {
    if (fetcher.state === "idle") {
      const data = fetcher.data as { error?: unknown } | undefined;
      if (publishSubmitInFlight && data?.error) {
        setLastPublishFailed(true);
        setSigningError(getClientDisplayErrorMessage(data.error));
      }
      setPublishSubmitInFlight(false);
    }
  }, [
    fetcher.state,
    fetcher.data,
    publishSubmitInFlight,
    setSigningError,
    setLastPublishFailed,
    setPublishSubmitInFlight,
  ]);

  const _handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string
  ) => {
    form.setValue("hashTagPresetId", presetId ?? undefined);
    setSelectedHashtags(hashtags);
    onHashtagPresetChange?.(presetId, hashtags);
  };

  const processNewFilesForSingleNote = React.useCallback(
    (files: File[]) => {
      const accepted = filterMediaFiles(files);
      if (accepted.length === 0) return;
      const newAttachments: ComposerAttachment[] = accepted.map((file) => ({
        localId: crypto.randomUUID(),
        status: "uploading",
        file,
        mime: file.type,
      }));
      let newContent = content;
      for (const a of newAttachments) {
        newContent = appendToken(newContent, a.localId);
      }
      form.setValue("content", newContent);
      setAttachments((prev) => [...prev, ...newAttachments]);
      void (async () => {
        try {
          const results = await uploadMultipleFiles(accepted);
          setAttachments((prev) =>
            prev.map((a) => {
              const idx = newAttachments.findIndex(
                (n) => n.localId === a.localId
              );
              if (idx < 0) return a;
              const r = results[idx];
              if (r?.success && r.file?.url) {
                return { ...a, status: "done" as const, url: r.file.url };
              }
              if (r && !r.success) {
                return { ...a, status: "failed" as const };
              }
              return a;
            })
          );
        } catch {
          setAttachments((prev) =>
            prev.map((a) => {
              const idx = newAttachments.findIndex(
                (n) => n.localId === a.localId
              );
              if (idx >= 0) return { ...a, status: "failed" as const };
              return a;
            })
          );
        }
      })();
    },
    [content, form, setAttachments]
  );

  const processNewFilesForSegment = React.useCallback(
    (segmentId: string, files: File[]) => {
      const accepted = filterMediaFiles(files);
      if (accepted.length === 0) return;
      const newAttachments: ComposerAttachment[] = accepted.map((file) => ({
        localId: crypto.randomUUID(),
        status: "uploading" as const,
        file,
        mime: file.type,
      }));
      setThreadSegments((prev) =>
        prev.map((p) => {
          if (p.id !== segmentId) return p;
          let newContent = p.content;
          for (const a of newAttachments) {
            newContent = appendToken(newContent, a.localId);
          }
          return {
            ...p,
            content: newContent,
            attachments: [...p.attachments, ...newAttachments],
          };
        })
      );
      void (async () => {
        try {
          const results = await uploadMultipleFiles(accepted);
          setThreadSegments((prev) =>
            prev.map((p) => {
              if (p.id !== segmentId) return p;
              return {
                ...p,
                attachments: p.attachments.map((a) => {
                  const idx = newAttachments.findIndex(
                    (n) => n.localId === a.localId
                  );
                  if (idx < 0) return a;
                  const r = results[idx];
                  if (r?.success && r.file?.url)
                    return {
                      ...a,
                      status: "done" as const,
                      url: r.file.url,
                    };
                  if (r && !r.success)
                    return { ...a, status: "failed" as const };
                  return a;
                }),
              };
            })
          );
        } catch {
          setThreadSegments((prev) =>
            prev.map((p) => {
              if (p.id !== segmentId) return p;
              return {
                ...p,
                attachments: p.attachments.map((a) => {
                  const idx = newAttachments.findIndex(
                    (n) => n.localId === a.localId
                  );
                  return idx >= 0 ? { ...a, status: "failed" as const } : a;
                }),
              };
            })
          );
        }
      })();
    },
    [setThreadSegments]
  );

  const handleAddAttachment = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (files.length === 0) return;
    processNewFilesForSingleNote(files);
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item?.kind === "file") {
          const file = item.getAsFile();
          if (file && ACCEPTED_MEDIA_TYPES.test(file.type)) files.push(file);
        }
      }
      if (files.length === 0) return;
      e.preventDefault();
      const firstSegment = threadSegments[0];
      if (isThreadMode && firstSegment) {
        processNewFilesForSegment(firstSegment.id, files);
      } else {
        processNewFilesForSingleNote(files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [
    isThreadMode,
    threadSegments,
    processNewFilesForSingleNote,
    processNewFilesForSegment,
  ]);

  const handleRemoveAttachment = (localId: string) => {
    form.setValue("content", removeToken(content, localId));
    setAttachments((prev) => prev.filter((a) => a.localId !== localId));
  };

  const disabled = fetcher.state !== "idle" || isSigning;
  const primarySubmitRef = useRef<HTMLButtonElement>(null);
  const draftSubmitRef = useRef<HTMLButtonElement>(null);
  const hasScheduleTimeForSubmit = !!(
    typeof (formScheduledFor ?? schedulingScheduledFor) === "string" &&
    (formScheduledFor ?? schedulingScheduledFor).trim()
  );

  const scheduleValForLabel = (
    formScheduledFor ?? schedulingScheduledFor
  ).trim();
  const scheduleTimeLabel = getScheduleTimeLabel(scheduleValForLabel);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (!disabled) draftSubmitRef.current?.click();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (disabled || signerReady === false) return;
        primarySubmitRef.current?.click();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, signerReady]);

  const relayCount =
    relayCountProp > 0
      ? relayCountProp
      : relayOverride && relayOverride.length > 0
        ? relayOverride.length
        : relayCountProp;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <fetcher.Form
        method="post"
        className="min-w-0 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(e);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          aria-hidden
          onChange={onFileChange}
        />
        <ComposerErrors
          isSigning={isSigning}
          signerLabel={signerLabel}
          onCancelSigning={clearSigningState}
          signingError={signingError}
          onDismissSigningError={() => {
            setSigningError(null);
            setLastPublishFailed(false);
          }}
          onRetry={() => primarySubmitRef.current?.click()}
          disabled={disabled}
          signerReady={signerReady}
        />
        <div className="my-8">
          <UnifiedComposerContentSection
            isThreadMode={isThreadMode}
            content={
              /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- form state can be undefined */
              content ?? ""
            }
            onContentChange={(v) => form.setValue("content", v)}
            contentError={form.formState.errors.content?.message ?? undefined}
            disabled={disabled}
            showDraftButton={!isTemplateMode}
            onOpenDraft={() => setDraftPickerOpen(true)}
            attachments={attachments}
            onRemoveAttachment={handleRemoveAttachment}
            onAddAttachment={handleAddAttachment}
            onFilesDroppedSingle={processNewFilesForSingleNote}
            threadSegments={threadSegments}
            onThreadSegmentsChange={setThreadSegments}
            threadDelayMinutes={threadDelayMinutes}
            onThreadDelayMinutesChange={setThreadDelayMinutes}
            onFilesDroppedSegment={processNewFilesForSegment}
            onThreadSegmentFileClick={(segmentId) => {
              (
                window as unknown as { __threadSegmentId?: string }
              ).__threadSegmentId = segmentId;
              document.getElementById("thread-segment-file-input")?.click();
            }}
            draggingOverSegmentId={draggingOverSegmentId}
            onDraggingOverSegmentIdChange={setDraggingOverSegmentId}
          />
        </div>
        <input
          id="thread-segment-file-input"
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          aria-hidden
          onChange={(e) => {
            const segmentId = (
              window as unknown as { __threadSegmentId?: string }
            ).__threadSegmentId;
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            if (!segmentId || files.length === 0) return;
            processNewFilesForSegment(segmentId, files);
          }}
        />
        {isTemplateMode ? (
          <div className="mt-4 space-y-2">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Weekly tip"
              className="max-w-xs"
              required
            />
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            {!isTemplateMode ? (
              <ComposerQueueField
                queueTypes={queueTypes}
                value={selectedQueue}
                onChange={setSelectedQueue}
                disabled={disabled}
                className="mb-2"
                nextSlot={
                  selectedQueueType &&
                  typeof selectedQueueType === "object" &&
                  (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
                    selectedQueueType.scheduleType === "WEEKLY_SLOTS")
                    ? getQueueNextSlotLabel(
                        formScheduledFor ?? schedulingScheduledFor
                      )
                    : undefined
                }
              />
            ) : null}
            <TagsChipRow
              tags={selectedHashtags}
              onTagsChange={(newTags) => {
                setSelectedHashtags(newTags);
                if (!newTags.trim()) {
                  form.setValue("useHashtagPresets", false);
                  form.setValue("hashTagPresetId", undefined);
                  onHashtagPresetChange?.(null, "");
                }
              }}
              presets={hashTagPresets}
              selectedPresetId={formSelectedHashtagPresetId}
              onPresetSelect={(presetId, mergedTags) => {
                setSelectedHashtags(mergedTags);
                form.setValue("useHashtagPresets", true);
                form.setValue("hashTagPresetId", presetId ?? undefined);
                onHashtagPresetChange?.(presetId, mergedTags);
              }}
              disabled={fetcher.state !== "idle"}
              queuePresetName={
                selectedQueue !== "unassigned"
                  ? ((
                      queueTypes.find(
                        (q) =>
                          (typeof q === "string" ? q : q.name) === selectedQueue
                      ) as
                        | (QueueType & {
                            hashTagPreset?: { name: string } | null;
                          })
                        | undefined
                    )?.hashTagPreset?.name ?? undefined)
                  : undefined
              }
            />
            {!isTemplateMode ? (
              <ComposerScheduleField
                value={
                  /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive default when scheduled values are unset */
                  formScheduledFor ?? schedulingScheduledFor ?? ""
                }
                onValueChange={(v) => {
                  form.setValue("scheduledFor", v);
                  setSchedulingScheduledFor(v);
                }}
                scheduleIntervals={scheduleIntervals}
                queueTypes={queueTypes}
                selectedQueue={selectedQueue}
                onScheduleIntervalClick={handleScheduleIntervalClick}
                onCalculateNextSlot={() =>
                  void calculateQueueScheduleTime(selectedQueue)
                }
                scheduleRandomWindowMinutes={scheduleRandomWindowMinutes}
                onScheduleRandomWindowMinutesChange={
                  setScheduleRandomWindowMinutes
                }
                postOptionsOpen={postOptionsOpen}
                onPostOptionsOpenChange={setPostOptionsOpen}
                isThreadMode={isThreadMode}
                onThreadModeChange={setIsThreadMode}
                isRecyclable={!!form.watch("isRecyclable")}
                onRecyclableChange={(v) => form.setValue("isRecyclable", v)}
                control={form.control}
                alsoScheduleRepost={alsoScheduleRepost}
                onAlsoScheduleRepostChange={setAlsoScheduleRepost}
                repostDelayList={repostDelayList}
                onRepostDelayListChange={setRepostDelayList}
                repostConditions={repostConditions}
                onRepostConditionsChange={setRepostConditions}
                alsoScheduleQuote={alsoScheduleQuote}
                onAlsoScheduleQuoteChange={setAlsoScheduleQuote}
                quoteEntries={quoteEntries}
                onQuoteEntriesChange={setQuoteEntries}
                disabled={disabled}
                userTimezone={user?.timezone ?? "UTC"}
                postOptionsSummary={
                  !postOptionsOpen &&
                  (isThreadMode ||
                    form.watch("isRecyclable") ||
                    alsoScheduleRepost ||
                    alsoScheduleQuote)
                    ? [
                        isThreadMode &&
                          `Thread · ${threadSegments.length} segment${threadSegments.length !== 1 ? "s" : ""}`,
                        form.watch("isRecyclable") && "Recyclable",
                        (alsoScheduleRepost || alsoScheduleQuote) &&
                          [
                            alsoScheduleRepost &&
                              `${repostDelayList.length} repost${repostDelayList.length !== 1 ? "s" : ""}`,
                            alsoScheduleQuote &&
                              `${quoteEntries.length} quote${quoteEntries.length !== 1 ? "s" : ""}`,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : undefined
                }
              />
            ) : null}
          </div>
          <div className="max-sm:bg-background/95 flex flex-col gap-2 max-sm:sticky max-sm:right-0 max-sm:bottom-0 max-sm:left-0 max-sm:z-10 max-sm:mt-4 max-sm:border-t max-sm:py-3 max-sm:backdrop-blur sm:flex-row sm:items-center">
            <ComposerActionButtons
              isTemplateMode={isTemplateMode}
              primarySubmitRef={primarySubmitRef}
              draftSubmitRef={draftSubmitRef}
              disabled={disabled}
              signerReady={signerReady}
              hasScheduleTimeForSubmit={hasScheduleTimeForSubmit}
              scheduleTimeLabel={scheduleTimeLabel}
              isThreadMode={isThreadMode}
              segmentCount={threadSegments.length}
              threadDelayMinutes={threadDelayMinutes}
              isSigning={isSigning}
              fetcherState={fetcher.state}
              templateName={templateName}
              editTemplateContext={editTemplateContext}
            />
          </div>
        </div>
      </fetcher.Form>
      <ConfidencePanel
        queueName={selectedQueue}
        nextSlot={
          selectedQueueType &&
          typeof selectedQueueType === "object" &&
          (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
            selectedQueueType.scheduleType === "WEEKLY_SLOTS")
            ? (formScheduledFor ?? schedulingScheduledFor).trim() || undefined
            : undefined
        }
        scheduledFor={
          (formScheduledFor ?? schedulingScheduledFor).trim() || undefined
        }
        timezone={user?.timezone ?? undefined}
        relativeTime={getRelativeTime(
          formScheduledFor ?? schedulingScheduledFor
        )}
        charCount={
          isThreadMode
            ? threadSegments.reduce((acc, s) => acc + s.content.length, 0)
            : content.length
        }
        attachmentCount={
          isThreadMode
            ? threadSegments.reduce((acc, s) => acc + s.attachments.length, 0)
            : attachments.length
        }
        signerType={signerLabel ?? undefined}
        relayCount={relayCount}
        summaryLine={getSummaryLine(
          selectedQueue,
          formScheduledFor ?? schedulingScheduledFor,
          isThreadMode,
          threadSegments.length,
          threadDelayMinutes
        )}
        threadSummary={
          isThreadMode
            ? `${threadSegments.length} segments · every ${threadDelayMinutes} min`
            : undefined
        }
        warnings={undefined}
        usesQueueSlot={
          !!(
            selectedQueueType &&
            typeof selectedQueueType === "object" &&
            (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
              selectedQueueType.scheduleType === "WEEKLY_SLOTS") &&
            (formScheduledFor ?? schedulingScheduledFor).trim()
          )
        }
      />
      <DraftPickerModal
        open={draftPickerOpen}
        onClose={() => setDraftPickerOpen(false)}
        type="short"
        onSelect={(id) => navigate(`/dashboard/newpost?draftId=${id}`)}
      />
    </div>
  );
}
