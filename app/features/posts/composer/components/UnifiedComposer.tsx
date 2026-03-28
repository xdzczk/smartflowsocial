/**
 * Unified composer: one surface for text + optional attachments.
 * Replaces Text/Media tabs with a single note editor and attachments strip.
 * Layout + composition of composer subcomponents and hooks.
 */

import { Link, useFetcher, useNavigate } from "@remix-run/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AlsoScheduleBlock } from "~/features/posts/components/AlsoScheduleBlock";
import { PublishingSummaryRail } from "~/features/posts/components/ConfidencePanel";
import {
  buildFollowUpCollapsedSummary,
  countRepostConditionRules,
} from "~/features/posts/components/follow-up";
import type { ComposerStatus } from "~/features/posts/components/NewPostHeader";
import {
  RailChip,
  RailChipGroup,
} from "~/features/posts/components/publishing-rail";
import { TagsChipRow } from "~/features/posts/components/TagsChipRow";
import { trackComposerEvent } from "~/features/posts/composer/utils/composer-analytics.client";
import {
  DraftPickerModal,
  type ShortDraftFilter,
} from "~/features/posts/drafts";
import { usePostScheduling } from "~/features/posts/scheduling";
import { uploadMany as uploadMultipleFiles } from "~/features/upload/media.client";
import { isBlossomProvider } from "~/features/upload/upload-provider-blossom.client";
import { getClientDisplayErrorMessage } from "~/lib/error-handler.client";
import { getUploadProvider } from "~/lib/query/hooks/useApiQuery";
import { useOptionalUser } from "~/lib/remix-utils";
import { cn } from "~/lib/utils";
import { textPostClientSchema } from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

import type { QueueType, ComposerAttachment } from "../../types";
import {
  appendToken,
  removeToken,
  reorderAttachmentTokensInContent,
} from "../../utils/inline-tokens.client";
import {
  useComposerLocalDraft,
  type ComposerLocalSnapshot,
} from "../hooks/useComposerLocalDraft";
import { useComposerSignerReconnect } from "../hooks/useComposerSignerReconnect";
import { useComposerState } from "../hooks/useComposerState";
import { useComposerSubmit } from "../hooks/useComposerSubmit";
import { useUnifiedComposerState } from "../hooks/useUnifiedComposerState";

import {
  ComposerCanvasDivider,
  ComposerErrors,
  ComposerLeftCanvas,
  ComposerOutputPanel,
  ComposerQueueField,
  ComposerScheduleField,
  type ComposerPublishMode,
  getTextSubmitActionForMode,
  getPrimaryCtaLabelForMode,
  getPrimaryCtaPendingLabelForMode,
  getReadinessPresentation,
  resolveComposerIssueDisplayPhase,
  buildPublishPathSummary,
  buildComposerContentSummaryLines,
  buildPublishingOutcomeSentence,
  formatPostStatusSummaryInline,
  formatPublishSummaryOptionsLine,
  getQueueNextSlotLabel,
} from "./composer";
import {
  composerAttachmentMime,
  filterMediaFiles,
} from "./composer/composer-helpers";
import { MIN_THREAD_SEGMENTS } from "./composer/thread-constants";
import { UnifiedComposerContentSection } from "./composer/unified-composer-sections";

/** Minute spacing options for thread cadence (publish rail). */
const THREAD_CADENCE_MINUTES_CHIPS = [1, 2, 3, 4, 5] as const;

export interface ContestEmbedPublishPayload {
  ok: true;
  embedContext: "contest";
  postId: string;
  nostrEventId: string | null;
  caption: string | null;
  publishedAt: string | null;
}

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
  /** Called when composer status changes (optional analytics/parent hooks). */
  onComposerStatusChange?: (status: ComposerStatus) => void;
  /** Opens relay selector (parent owns modal). */
  onRelayClick?: () => void;
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
  /** POST target for the composer form (default: current route). Use `/dashboard/compose?type=post` when embedding. */
  formAction?: string;
  /** localStorage key for autosave draft (default: composer-newpost-draft). */
  localDraftStorageKey?: string;
  /** Base path for "Drafts" navigation (default: /dashboard/compose). */
  draftPickerNavigateBase?: string;
  /**
   * When set (including empty array), the Drafts control opens a combined
   * drafts + templates picker and the button label becomes "Drafts / Templates".
   */
  composerTemplates?: Array<{ id: string; name: string | null }>;
  /**
   * When opening the short draft list, limit to poll or thread-shaped drafts.
   * Defaults to thread-only when `newPostContentTab` is `thread`, else all.
   */
  shortDraftFilter?: ShortDraftFilter;
  /** When set, sends `_embedContext` so newpost action can return JSON instead of redirecting. */
  embedContext?: "contest";
  /** Called after a successful publish when `embedContext` is set (JSON response from server). */
  onEmbedPublishSuccess?: (payload: ContestEmbedPublishPayload) => void;
  /**
   * When `embedContext` is `contest`, controls UI density. Defaults to `contest-lite`
   * (queue/tags/advanced schedule behind a collapsible).
   */
  embeddedDensity?: "full" | "contest-lite";
  /**
   * New Post page tabs: when set, thread mode follows the tab and the thread
   * checkbox is omitted from Post options.
   */
  newPostContentTab?: "post" | "thread";
  publishMode?: ComposerPublishMode;
  onPublishModeChange?: (next: ComposerPublishMode) => void;
  onDraftStateLabelChange?: (label: string) => void;
  /**
   * When true, omit built-in draft/template picker UI and modal (e.g. New Post page uses shell actions).
   */
  suppressBuiltInDraftPicker?: boolean;
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
  formAction,
  localDraftStorageKey = "composer-newpost-draft",
  draftPickerNavigateBase = "/dashboard/compose",
  embedContext,
  onEmbedPublishSuccess,
  embeddedDensity,
  newPostContentTab,
  publishMode = "now",
  onPublishModeChange,
  onDraftStateLabelChange,
  onRelayClick,
  composerTemplates,
  shortDraftFilter: shortDraftFilterProp,
  suppressBuiltInDraftPicker = false,
}: UnifiedComposerProps) {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const lastHandledEmbedPostIdRef = React.useRef<string | null>(null);
  const draftTemplatesPickerEnabled = composerTemplates !== undefined;
  const [draftPicker, setDraftPicker] = useState<{
    open: boolean;
    mode: "drafts" | "templates";
  }>({ open: false, mode: "drafts" });
  const shortDraftFilter: ShortDraftFilter =
    shortDraftFilterProp ?? (newPostContentTab === "thread" ? "thread" : "all");
  const user = useOptionalUser();
  const isTemplateMode = mode === "template";
  const isContestLite =
    embedContext === "contest" &&
    (embeddedDensity ?? "contest-lite") === "contest-lite";
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
    publishSubmitInFlight,
    setPublishSubmitInFlight,
    lastPublishFailed,
    setLastPublishFailed,
    signerLabel,
    signerReady,
    windowNostrBridgePresent,
    selectedHashtags,
    setSelectedHashtags,
    templateName,
    setTemplateName,
    attachments,
    setAttachments,
    fileInputRef,
    repostDelayList,
    setRepostDelayList,
    repostConditions,
    setRepostConditions,
    quoteEntries,
    setQuoteEntries,
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

  const alsoScheduleRepost = repostDelayList.length > 0;
  const alsoScheduleQuote = quoteEntries.length > 0;

  const [mediaUploadProvider, setMediaUploadProvider] = useState<
    string | undefined
  >();
  const [mediaUploadProviderKnown, setMediaUploadProviderKnown] =
    useState(false);

  const uploadProviderFetchActiveRef = useRef(false);
  useEffect(() => {
    uploadProviderFetchActiveRef.current = true;
    void (async () => {
      try {
        const d = await getUploadProvider();
        if (uploadProviderFetchActiveRef.current) {
          setMediaUploadProvider(d.provider);
        }
      } catch {
        // ignore — treat as unknown provider until a later refresh
      } finally {
        if (uploadProviderFetchActiveRef.current) {
          setMediaUploadProviderKnown(true);
        }
      }
    })();
    return () => {
      uploadProviderFetchActiveRef.current = false;
    };
  }, []);

  const blossomMediaUploads =
    mediaUploadProviderKnown && isBlossomProvider(mediaUploadProvider);

  const blossomSignerMediaNote = useMemo(() => {
    if (
      !blossomMediaUploads ||
      signerReady !== false ||
      windowNostrBridgePresent
    ) {
      return;
    }
    return (
      <div
        className={cn(
          "rounded-md border px-2.5 py-2 text-[11px] leading-snug",
          "border-amber-500/55 bg-amber-500/10 text-amber-950 dark:text-amber-50"
        )}
      >
        <span className="font-medium">No active Nostr signer</span>
        {" — "}
        Blossom media uploads need a{" "}
        <span className="font-medium">browser extension</span> (NIP-07) or a{" "}
        <span className="font-medium">connected remote signer</span> (NIP-46).
        Open{" "}
        <Link
          to="/dashboard/settings"
          className="text-primary font-medium underline underline-offset-2"
        >
          Settings
        </Link>{" "}
        to connect or reconnect your signer.
      </div>
    );
  }, [blossomMediaUploads, signerReady, windowNostrBridgePresent]);

  const attachmentFailedTitleHint =
    blossomMediaUploads && signerReady === false && !windowNostrBridgePresent
      ? "Upload failed. Reconnect your Nostr signer in Settings, remove this file, and add it again."
      : undefined;

  const [publishAttempted, setPublishAttempted] = useState(false);
  const [composerTouched, setComposerTouched] = useState(false);

  React.useEffect(() => {
    if (!newPostContentTab) return;
    setIsThreadMode(newPostContentTab === "thread");
  }, [newPostContentTab, setIsThreadMode]);

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
    localDraftStorageKey,
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
    if (
      localRestored.contentType === "thread" &&
      localRestored.threadSegments
    ) {
      const mapped = localRestored.threadSegments.map((segment) => ({
        id: segment.id,
        content: segment.content,
        attachments: segment.attachments.map((attachment) => ({
          localId: attachment.localId,
          url: attachment.url,
          alt: attachment.alt,
          status: "done" as const,
        })),
      }));
      const padded = [...mapped];
      while (padded.length < MIN_THREAD_SEGMENTS) {
        padded.push({
          id: crypto.randomUUID(),
          content: "",
          attachments: [],
        });
      }
      setThreadSegments(padded);
      if (typeof localRestored.threadDelayMinutes === "number") {
        const d = localRestored.threadDelayMinutes;
        setThreadDelayMinutes(
          (THREAD_CADENCE_MINUTES_CHIPS as readonly number[]).includes(d)
            ? d
            : 1
        );
      }
    }
    setSelectedQueue(localRestored.queueType);
    trackComposerEvent("composer_draft_restored", {
      source: localRestored.contentType === "thread" ? "thread" : "post",
      mode: "local",
    });
  }, [
    localRestored,
    initialDraftId,
    skipLocalDraftRestore,
    form,
    setSelectedQueue,
    setAttachments,
    setSelectedHashtags,
    setThreadSegments,
    setThreadDelayMinutes,
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

  const pendingExplicitSaveDraftRef = useRef(false);
  const fetcherWasBusyRef = useRef(false);
  const [serverDraftSavedBaseline, setServerDraftSavedBaseline] = useState<
    string | null
  >(null);

  const composerDraftFingerprint = useMemo(
    () =>
      JSON.stringify({
        content: content,
        selectedHashtags,
        scheduledFor: formScheduledFor ?? "",
        selectedQueue,
        hashTagPresetId: formSelectedHashtagPresetId ?? null,
        attachments: attachments
          .filter((a): a is typeof a & { url: string } => Boolean(a.url))
          .map((a) => ({
            localId: a.localId,
            url: a.url,
            alt: a.alt,
          })),
        isThreadMode,
        threadSegments: isThreadMode
          ? threadSegments.map((s) => ({
              id: s.id,
              content: s.content,
              attachments: s.attachments
                .filter((a): a is typeof a & { url: string } => Boolean(a.url))
                .map((a) => ({
                  localId: a.localId,
                  url: a.url,
                  alt: a.alt,
                })),
            }))
          : undefined,
        threadDelayMinutes: isThreadMode ? threadDelayMinutes : undefined,
      }),
    [
      content,
      selectedHashtags,
      formScheduledFor,
      selectedQueue,
      formSelectedHashtagPresetId,
      attachments,
      isThreadMode,
      threadSegments,
      threadDelayMinutes,
    ]
  );

  React.useEffect(() => {
    setServerDraftSavedBaseline((prev) => {
      if (prev === null) return null;
      return prev === composerDraftFingerprint ? prev : null;
    });
  }, [composerDraftFingerprint]);

  // Persist to localStorage when not editing a server draft
  React.useEffect(() => {
    if (initialDraftId || skipLocalDraftRestore) return;
    const snapshot: Omit<ComposerLocalSnapshot, "savedAt"> = {
      version: 2,
      contentType: isThreadMode ? "thread" : "post",
      content: content ?? "", // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- form state can be undefined
      queueType: selectedQueue,
      queueTypeId,

      scheduledFor: formScheduledFor ?? "",
      tags: selectedHashtags,
      hashTagPresetId: formSelectedHashtagPresetId ?? null,
      attachmentMeta: attachments
        .filter((a): a is typeof a & { url: string } => Boolean(a.url))
        .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt })),
      threadSegments: isThreadMode
        ? threadSegments.map((segment) => ({
            id: segment.id,
            content: segment.content,
            attachments: segment.attachments.map((attachment) => ({
              localId: attachment.localId,
              url: attachment.url,
              alt: attachment.alt,
            })),
          }))
        : undefined,
      threadDelayMinutes: isThreadMode ? threadDelayMinutes : undefined,
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
    isThreadMode,
    threadSegments,
    threadDelayMinutes,
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

  React.useEffect(() => {
    if (repostDelayList.length === 0) {
      setRepostConditions(null);
    }
  }, [repostDelayList.length, setRepostConditions]);

  const onBeginSaveDraft = useCallback(() => {
    pendingExplicitSaveDraftRef.current = true;
  }, []);

  const {
    runSubmit,
    isSigning,
    signingError,
    setSigningError,
    cancelSigningState,
    retryLastSubmit,
    partialThreadState,
    submitThreadSuccessfulOnly,
    retryThreadFailed,
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
    submitAction: formAction,
    embedContext,
    publishMode,
    calculateQueueScheduleTime,
    onBeginSaveDraft,
  });

  useComposerSignerReconnect(cancelSigningState, isSigning, retryLastSubmit);

  const handleSubmit = form.handleSubmit((data, event) => {
    void runSubmit(data, event);
  });

  const hasContent = isThreadMode
    ? threadSegments.every(
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
    trackComposerEvent("composer_queue_selected", { queue: selectedQueue });
  }, [selectedQueue]);

  React.useEffect(() => {
    if (fetcher.state === "idle") {
      const data = fetcher.data as { error?: unknown } | undefined;
      if (publishSubmitInFlight && data?.error) {
        setLastPublishFailed(true);
        setSigningError(getClientDisplayErrorMessage(data.error));
        trackComposerEvent("composer_publish_failed", { source: "unified" });
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

  React.useEffect(() => {
    if (fetcher.state !== "idle" || !embedContext || !onEmbedPublishSuccess)
      return;
    const data = fetcher.data as
      | Partial<ContestEmbedPublishPayload>
      | undefined;
    if (
      !data?.ok ||
      data.embedContext !== "contest" ||
      typeof data.postId !== "string"
    ) {
      return;
    }
    if (lastHandledEmbedPostIdRef.current === data.postId) return;
    lastHandledEmbedPostIdRef.current = data.postId;
    onEmbedPublishSuccess(data as ContestEmbedPublishPayload);
  }, [embedContext, fetcher.state, fetcher.data, onEmbedPublishSuccess]);

  React.useEffect(() => {
    if (!signingError) return;
    trackComposerEvent("composer_validation_blocker", {
      blocker: signingError,
    });
  }, [signingError]);

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
        mime: composerAttachmentMime(file),
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
        mime: composerAttachmentMime(file),
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
      const raw: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item?.kind === "file") {
          const file = item.getAsFile();
          if (file) raw.push(file);
        }
      }
      const files = filterMediaFiles(raw);
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

  const handleReorderAttachments = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      setAttachments((prev) => {
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex >= prev.length
        ) {
          return prev;
        }
        const next = [...prev];
        const moved = next.splice(fromIndex, 1)[0];
        if (!moved) return prev;
        next.splice(toIndex, 0, moved);
        const ids = next.map((a) => a.localId);
        const body = form.getValues("content");
        form.setValue("content", reorderAttachmentTokensInContent(body, ids), {
          shouldDirty: true,
        });
        return next;
      });
    },
    [form, setAttachments]
  );

  const disabled = fetcher.state !== "idle" || isSigning;
  const primarySubmitRef = useRef<HTMLButtonElement>(null);
  const draftSubmitRef = useRef<HTMLButtonElement>(null);
  const hasScheduleTimeForSubmit = !!(
    typeof (formScheduledFor ?? schedulingScheduledFor) === "string" &&
    (formScheduledFor ?? schedulingScheduledFor).trim()
  );

  const hardBlockers: string[] = [];
  if (signerReady === false) {
    hardBlockers.push("Signer not connected");
  }

  const deferrableBlockers: string[] = [];
  if (!canSubmit) {
    deferrableBlockers.push("Resolve media upload issues before publishing");
  }
  if (publishMode === "schedule" && !hasScheduleTimeForSubmit) {
    deferrableBlockers.push("Publish time is required");
  }
  if (publishMode === "queue" && selectedQueue === "unassigned") {
    deferrableBlockers.push("Choose a queue");
  }
  if (isThreadMode && threadSegments.length < MIN_THREAD_SEGMENTS) {
    deferrableBlockers.push(
      "Threads need at least two segments. Add another below the first."
    );
  }
  if (!hasContent) {
    deferrableBlockers.push(
      isThreadMode
        ? "Each thread segment needs text or at least one media item."
        : "Add text or at least one media item."
    );
  }
  const relayCount =
    relayCountProp > 0
      ? relayCountProp
      : relayOverride && relayOverride.length > 0
        ? relayOverride.length
        : relayCountProp;
  if (relayCount <= 0) {
    deferrableBlockers.push("Select at least one relay.");
  }

  const issueList = [...hardBlockers, ...deferrableBlockers];

  const issueDisplayPhase = resolveComposerIssueDisplayPhase(
    publishAttempted,
    composerTouched
  );
  const displayRedIssues =
    issueDisplayPhase === "blocking"
      ? [...hardBlockers, ...deferrableBlockers]
      : [...hardBlockers];
  const displayAmberIssues =
    issueDisplayPhase === "soft" ? [...deferrableBlockers] : [];

  const pristineHint =
    issueDisplayPhase === "pristine" &&
    deferrableBlockers.length > 0 &&
    hardBlockers.length === 0
      ? "Content required to publish. Add text or media and select relays to continue."
      : undefined;
  const idleStatusLabel =
    issueDisplayPhase === "pristine" &&
    deferrableBlockers.length > 0 &&
    hardBlockers.length === 0
      ? "Draft"
      : undefined;

  const readinessForRail =
    displayRedIssues.length > 0
      ? getReadinessPresentation(publishMode, displayRedIssues, signerReady)
      : displayAmberIssues.length > 0
        ? ({
            tone: "warn",
            headline: "Missing requirements",
          } as const)
        : getReadinessPresentation(publishMode, [], signerReady);

  // Defer setState to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    if (issueList.length === 0 && publishAttempted) {
      queueMicrotask(() => setPublishAttempted(false));
    }
  }, [issueList.length, publishAttempted]);

  useEffect(() => {
    const threadTouch = isThreadMode
      ? threadSegments.some(
          (s) => s.content.trim().length > 0 || s.attachments.length > 0
        )
      : false;
    if (
      content.trim().length > 0 ||
      attachments.length > 0 ||
      selectedHashtags.trim().length > 0 ||
      threadTouch
    ) {
      queueMicrotask(() => setComposerTouched(true));
    }
  }, [
    content,
    attachments.length,
    selectedHashtags,
    isThreadMode,
    threadSegments,
  ]);

  useEffect(() => {
    if (publishMode !== "now") {
      queueMicrotask(() => setComposerTouched(true));
    }
  }, [publishMode]);

  useEffect(() => {
    if (selectedQueue !== "unassigned") {
      queueMicrotask(() => setComposerTouched(true));
    }
  }, [selectedQueue]);

  useEffect(() => {
    const t = (formScheduledFor ?? schedulingScheduledFor).trim();
    if (t) queueMicrotask(() => setComposerTouched(true));
  }, [formScheduledFor, schedulingScheduledFor]);

  const handleRelayRailClick = useCallback(() => {
    setComposerTouched(true);
    onRelayClick?.();
  }, [onRelayClick]);
  const isRecyclableVal = !!form.watch("isRecyclable");
  const contentSummaryLines = isThreadMode
    ? [
        `${threadSegments.length} segments`,
        `${threadSegments.reduce((acc, s) => acc + s.content.length, 0)} characters`,
        `${threadSegments.reduce((acc, s) => acc + s.attachments.length, 0)} media`,
      ]
    : buildComposerContentSummaryLines(
        content.length,
        attachments.length,
        selectedHashtags,
        isRecyclableVal
      );
  const publishPath = buildPublishPathSummary(
    relayCount,
    signerLabel,
    selectedQueue
  );
  const threadSettingsLines = isThreadMode
    ? [
        `Cadence: every ${threadDelayMinutes} min`,
        `Estimated duration: ${Math.max(threadSegments.length - 1, 0) * threadDelayMinutes} min`,
      ]
    : [];

  const queueNextSlotLabel = getQueueNextSlotLabel(
    formScheduledFor ?? schedulingScheduledFor
  );

  const threadCharCount = threadSegments.reduce(
    (acc, s) => acc + s.content.length,
    0
  );
  const threadMediaCount = threadSegments.reduce(
    (acc, s) => acc + s.attachments.length,
    0
  );
  const postStatusSummaryInline = isThreadMode
    ? `${threadSegments.length} segments · ${threadCharCount} chars · ${threadMediaCount} media`
    : formatPostStatusSummaryInline(
        content.length,
        attachments.length,
        selectedHashtags,
        isRecyclableVal
      );
  const publishSummaryTagsLine = isThreadMode
    ? selectedHashtags.trim() || "none"
    : undefined;

  const outcomeSentence = buildPublishingOutcomeSentence({
    publishMode,
    relayCount,
    signerReady,
    scheduledFor:
      (formScheduledFor ?? "").trim() !== ""
        ? (formScheduledFor ?? "")
        : schedulingScheduledFor,
    hasScheduleTime: hasScheduleTimeForSubmit,
    selectedQueue,
    queueNextSlotLabel: publishMode === "queue" ? queueNextSlotLabel : null,
  });

  const followUpSummaryLine = buildFollowUpCollapsedSummary({
    repostCount: repostDelayList.length,
    quoteCount: quoteEntries.length,
    conditionRuleCount: countRepostConditionRules(repostConditions),
  });

  const primaryActionLoading = fetcher.state !== "idle" || isSigning;

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

  useEffect(() => {
    if (!onDraftStateLabelChange) return;

    const busy = fetcher.state !== "idle";

    if (busy) {
      fetcherWasBusyRef.current = true;
      onDraftStateLabelChange(
        pendingExplicitSaveDraftRef.current ? "Saving draft…" : "Saving…"
      );
      return;
    }

    const completedNetworkRequest = fetcherWasBusyRef.current;
    fetcherWasBusyRef.current = false;

    if (completedNetworkRequest && pendingExplicitSaveDraftRef.current) {
      pendingExplicitSaveDraftRef.current = false;
      const data = fetcher.data as
        | { error?: unknown; draftSaved?: boolean; draftId?: string }
        | undefined;
      const jsonError =
        data &&
        typeof data === "object" &&
        "error" in data &&
        data.error != null &&
        data.error !== "";
      const serverConfirmedSave =
        data &&
        typeof data === "object" &&
        data.draftSaved === true &&
        typeof data.draftId === "string" &&
        data.draftId.length > 0;
      if (!jsonError && serverConfirmedSave) {
        const savedDraftId = data.draftId;
        queueMicrotask(() => {
          setServerDraftSavedBaseline(composerDraftFingerprint);
          onDraftStateLabelChange("Draft saved");
          if (!initialDraftId && savedDraftId) {
            const base = draftPickerNavigateBase;
            const sep = base.includes("?") ? "&" : "?";
            navigate(
              `${base}${sep}draftId=${encodeURIComponent(savedDraftId)}`,
              { replace: true }
            );
          }
        });
        return;
      }
    }

    if (
      serverDraftSavedBaseline !== null &&
      composerDraftFingerprint === serverDraftSavedBaseline
    ) {
      onDraftStateLabelChange("Draft saved");
      return;
    }

    if (!initialDraftId && !skipLocalDraftRestore) {
      onDraftStateLabelChange("Saved locally");
      return;
    }

    onDraftStateLabelChange("");
  }, [
    fetcher.state,
    fetcher.data,
    draftPickerNavigateBase,
    navigate,
    composerDraftFingerprint,
    serverDraftSavedBaseline,
    initialDraftId,
    skipLocalDraftRestore,
    onDraftStateLabelChange,
  ]);

  const primarySubmitAction = getTextSubmitActionForMode(publishMode);

  const openDraftPicker = (mode: "drafts" | "templates") => {
    setDraftPicker({ open: true, mode });
  };

  const composerHeaderTrailing =
    !isTemplateMode && !suppressBuiltInDraftPicker ? (
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => openDraftPicker("drafts")}
          disabled={disabled}
          aria-label="Open drafts"
          className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
        >
          Drafts
        </Button>
        {draftTemplatesPickerEnabled ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openDraftPicker("templates")}
            disabled={disabled}
            aria-label="Open templates"
            className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
          >
            Templates
          </Button>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <fetcher.Form
        method="post"
        {...(formAction ? { action: formAction } : {})}
        className="min-w-0 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(e);
        }}
      >
        <input
          type="hidden"
          name="contentType"
          value={isThreadMode ? "thread" : "post"}
        />
        {embedContext ? (
          <input type="hidden" name="_embedContext" value={embedContext} />
        ) : null}
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
          onCancelSigning={cancelSigningState}
          signingError={signingError}
          onDismissSigningError={() => {
            setSigningError(null);
            setLastPublishFailed(false);
          }}
          onRetry={() => primarySubmitRef.current?.click()}
          disabled={disabled}
          signerReady={signerReady}
        />
        <Dialog
          open={partialThreadState !== null}
          onOpenChange={(open) => {
            if (!open) cancelSigningState();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Some thread segments could not be signed
              </DialogTitle>
              <DialogDescription>
                {partialThreadState
                  ? `${partialThreadState.failedIndices.length} of ${threadSegments.length} segments failed to sign after retry. You can schedule only the ${partialThreadState.signedEvents.length} successfully signed segments, or retry signing the failed ones.`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={cancelSigningState}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={retryThreadFailed}
              >
                Retry failed signing
              </Button>
              <Button
                type="button"
                onClick={() => void submitThreadSuccessfulOnly()}
                className="bg-success hover:bg-success/90 text-white"
              >
                Schedule {partialThreadState?.signedEvents.length ?? 0} segments
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="mb-4">
          <ComposerLeftCanvas
            headerTrailing={composerHeaderTrailing ?? undefined}
          >
            <UnifiedComposerContentSection
              isThreadMode={isThreadMode}
              content={
                /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- form state can be undefined */
                content ?? ""
              }
              onContentChange={(v) => form.setValue("content", v)}
              contentError={form.formState.errors.content?.message ?? undefined}
              disabled={disabled}
              attachments={attachments}
              onRemoveAttachment={handleRemoveAttachment}
              onAddAttachment={handleAddAttachment}
              onReorderAttachments={handleReorderAttachments}
              onFilesDroppedSingle={processNewFilesForSingleNote}
              threadSegments={threadSegments}
              onThreadSegmentsChange={setThreadSegments}
              threadDelayMinutes={threadDelayMinutes}
              onFilesDroppedSegment={processNewFilesForSegment}
              onThreadSegmentFileClick={(segmentId) => {
                (
                  window as unknown as { __threadSegmentId?: string }
                ).__threadSegmentId = segmentId;
                document.getElementById("thread-segment-file-input")?.click();
              }}
              draggingOverSegmentId={draggingOverSegmentId}
              onDraggingOverSegmentIdChange={setDraggingOverSegmentId}
              blossomSignerMediaNote={blossomSignerMediaNote}
              attachmentFailedTitleHint={attachmentFailedTitleHint}
            />
            {!isTemplateMode ? (
              <>
                <ComposerCanvasDivider />
                {!isThreadMode ? (
                  <ComposerOutputPanel
                    variant="embedded"
                    content={content}
                    attachments={attachments}
                    tagsLine={selectedHashtags}
                  />
                ) : (
                  <ComposerOutputPanel
                    variant="embedded"
                    content={threadSegments[0]?.content ?? ""}
                    attachments={threadSegments[0]?.attachments ?? []}
                    tagsLine={selectedHashtags}
                    previewLabel="Preview (first segment)"
                  />
                )}
                <ComposerCanvasDivider />
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
                              (typeof q === "string" ? q : q.name) ===
                              selectedQueue
                          ) as
                            | (QueueType & {
                                hashTagPreset?: { name: string } | null;
                              })
                            | undefined
                        )?.hashTagPreset?.name ?? undefined)
                      : undefined
                  }
                />
              </>
            ) : null}
          </ComposerLeftCanvas>
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
        {/* Rail CTAs trigger these submitters via refs. */}
        <button
          ref={primarySubmitRef}
          type="submit"
          name="_action"
          value={primarySubmitAction}
          className="hidden"
          aria-hidden
          tabIndex={-1}
        />
        {!isTemplateMode ? (
          <button
            ref={draftSubmitRef}
            type="submit"
            name="_action"
            value="save-draft"
            className="hidden"
            aria-hidden
            tabIndex={-1}
          />
        ) : null}
      </fetcher.Form>
      {!isContestLite ? (
        <PublishingSummaryRail
          publishMode={publishMode}
          onPublishModeChange={onPublishModeChange ?? (() => void 0)}
          outcomeSentence={outcomeSentence}
          readiness={readinessForRail}
          sessionStrip={{
            composerStatus,
            relayCount,
            onRelayClick: handleRelayRailClick,
            signerLabel: signerReady === false ? "Not connected" : signerLabel,
          }}
          modeSpecificSection={
            publishMode === "now"
              ? undefined
              : {
                  lines:
                    publishMode === "queue"
                      ? [
                          ...(selectedQueueType &&
                          typeof selectedQueueType === "object" &&
                          (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
                            selectedQueueType.scheduleType ===
                              "WEEKLY_SLOTS") &&
                          queueNextSlotLabel
                            ? [`Next slot (estimate): ${queueNextSlotLabel}`]
                            : []),
                        ]
                      : [],
                  controls:
                    publishMode === "queue" ? (
                      <div className="space-y-2">
                        <ComposerQueueField
                          queueTypes={queueTypes}
                          value={selectedQueue}
                          onChange={setSelectedQueue}
                          disabled={disabled}
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
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <ComposerScheduleField
                          value={formScheduledFor ?? ""}
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
                          scheduleRandomWindowMinutes={
                            scheduleRandomWindowMinutes
                          }
                          onScheduleRandomWindowMinutesChange={
                            setScheduleRandomWindowMinutes
                          }
                          disabled={disabled}
                          userTimezone={user?.timezone ?? "UTC"}
                        />
                      </div>
                    ),
                }
          }
          followUp={{
            summaryLine: followUpSummaryLine,
            children: (
              <AlsoScheduleBlock
                repostDelayList={repostDelayList}
                onRepostDelayListChange={setRepostDelayList}
                repostConditions={repostConditions}
                onRepostConditionsChange={setRepostConditions}
                quoteEntries={quoteEntries}
                onQuoteEntriesChange={setQuoteEntries}
                disabled={disabled}
              />
            ),
          }}
          postStatusSummaryInline={postStatusSummaryInline}
          publishSummaryTagsLine={publishSummaryTagsLine}
          publishSummaryOptionsLine={formatPublishSummaryOptionsLine({
            followUpSummaryLine: followUpSummaryLine,
            showRecyclable: true,
            isRecyclable: isRecyclableVal,
          })}
          contentSummaryLines={contentSummaryLines}
          publishPath={publishPath}
          recyclableControl={
            !isTemplateMode
              ? {
                  switchId: "composer-recyclable",
                  checked: isRecyclableVal,
                  onCheckedChange: (checked) =>
                    form.setValue("isRecyclable", checked === true),
                  disabled,
                }
              : undefined
          }
          threadSettingsSection={
            isThreadMode
              ? {
                  title: "Thread settings",
                  lines: threadSettingsLines,
                  controls: (
                    <RailChipGroup>
                      {THREAD_CADENCE_MINUTES_CHIPS.map((v) => (
                        <RailChip
                          key={v}
                          type="button"
                          selected={threadDelayMinutes === v}
                          onClick={() => {
                            setComposerTouched(true);
                            setThreadDelayMinutes(v);
                          }}
                          disabled={disabled}
                        >
                          {v}m
                        </RailChip>
                      ))}
                    </RailChipGroup>
                  ),
                }
              : undefined
          }
          issues={displayRedIssues}
          warnings={displayAmberIssues}
          pristineHint={pristineHint}
          idleStatusLabel={idleStatusLabel}
          primaryActionLabel={getPrimaryCtaLabelForMode(
            publishMode,
            isThreadMode ? "thread" : "post"
          )}
          primaryActionLoading={primaryActionLoading}
          primaryActionLoadingLabel={getPrimaryCtaPendingLabelForMode(
            publishMode,
            isThreadMode ? "thread" : "post"
          )}
          onPrimaryAction={() => primarySubmitRef.current?.click()}
          onPrimaryActionBlocked={() => setPublishAttempted(true)}
          primaryActionDisabled={
            disabled || signerReady === false || issueList.length > 0
          }
          secondaryActionLabel={isTemplateMode ? undefined : "Save draft"}
          onSecondaryAction={
            isTemplateMode ? undefined : () => draftSubmitRef.current?.click()
          }
          secondaryActionDisabled={disabled}
        />
      ) : null}
      {!suppressBuiltInDraftPicker ? (
        <DraftPickerModal
          key={draftPicker.mode}
          open={draftPicker.open}
          onClose={() => setDraftPicker((s) => ({ ...s, open: false }))}
          type="short"
          shortDraftFilter={shortDraftFilter}
          onSelect={
            draftPicker.mode === "drafts"
              ? (id) => {
                  const separator = draftPickerNavigateBase.includes("?")
                    ? "&"
                    : "?";
                  navigate(
                    `${draftPickerNavigateBase}${separator}draftId=${encodeURIComponent(id)}`
                  );
                }
              : undefined
          }
          draftsAndTemplates={
            draftPicker.mode === "templates" && draftTemplatesPickerEnabled
              ? {
                  templates: composerTemplates,
                  templatesOnly: true,
                  onSelectTemplate: (templateId) => {
                    const separator = draftPickerNavigateBase.includes("?")
                      ? "&"
                      : "?";
                    navigate(
                      `${draftPickerNavigateBase}${separator}templateId=${encodeURIComponent(templateId)}`
                    );
                  },
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
