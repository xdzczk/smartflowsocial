/**
 * Unified composer: one surface for text + optional attachments.
 * Replaces Text/Media tabs with a single note editor and attachments strip.
 * Layout + composition of composer subcomponents and hooks.
 */

import { useFetcher, useNavigate } from "@remix-run/react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  buildFollowUpCollapsedSummary,
  countRepostConditionRules,
} from "~/features/posts/components/follow-up";
import type { ComposerStatus } from "~/features/posts/components/NewPostHeader";
import { trackComposerEvent } from "~/features/posts/composer/utils/composer-analytics.client";
import {
  applyThreadSegmentNumberingToSegments,
  stripLeadingThreadSegmentNumber,
} from "~/features/posts/composer/utils/thread-segment-numbering";
import {
  DraftPickerModal,
  type ShortDraftFilter,
} from "~/features/posts/drafts";
import { usePostScheduling } from "~/features/posts/scheduling";
import { getClientDisplayErrorMessage } from "~/lib/error-handler.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { cn } from "~/lib/utils";
import { textPostClientSchema } from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

import {
  defaultIncludeHashtagsForQueueSelection,
  type QueueType,
  type ComposerAttachment,
} from "../../types";
import { stripAttachmentTokens } from "../../utils/inline-tokens.client";
import type { TextPostFormData } from "../hooks/composer-submit-types";
import {
  useComposerLocalDraft,
  type ComposerLocalSnapshot,
} from "../hooks/useComposerLocalDraft";
import { useComposerSignerReconnect } from "../hooks/useComposerSignerReconnect";
import { useComposerState } from "../hooks/useComposerState";
import { useComposerSubmit } from "../hooks/useComposerSubmit";
import { useUnifiedComposerState } from "../hooks/useUnifiedComposerState";
import { UnifiedComposerPreviewBlock } from "../preview/UnifiedComposerPreviewBlock";
import type { ComposerContext } from "../services/compose-route-contract";

import {
  ComposerCanvasDivider,
  ComposerErrors,
  ComposerLeftCanvas,
  type ComposerPublishMode,
  getTextSubmitActionForMode,
  getReadinessPresentation,
  resolveComposerIssueDisplayPhase,
  buildPublishPathSummary,
  buildComposerContentSummaryLines,
  buildPublishingOutcomeSentence,
  formatPostStatusSummaryInline,
  getQueueNextSlotLabel,
} from "./composer";
import { MIN_THREAD_SEGMENTS } from "./composer/thread-constants";
import { UnifiedComposerContentSection } from "./composer/unified-composer-sections";
import type { ContestEmbedPublishPayload } from "./unified-composer/contest-embed-types";
import { THREAD_CADENCE_MINUTES_CHIPS } from "./unified-composer/unified-composer-constants";
import {
  buildUnifiedComposerHardAndDeferrableBlockers,
  buildUnifiedComposerTemplateRailWarnings,
} from "./unified-composer/unified-composer-issue-lists";
import { UnifiedComposerDraftHeaderTrailing } from "./unified-composer/UnifiedComposerDraftHeaderTrailing";
import { UnifiedComposerPublishingSummaryRail } from "./unified-composer/UnifiedComposerPublishingSummaryRail";
import { UnifiedComposerTagsSection } from "./unified-composer/UnifiedComposerTagsSection";
import { UnifiedComposerTemplateSettingsRail } from "./unified-composer/UnifiedComposerTemplateSettingsRail";
import { UnifiedComposerThreadPartialSignDialog } from "./unified-composer/UnifiedComposerThreadPartialSignDialog";
import { useUnifiedComposerAttachmentHandlers } from "./unified-composer/useUnifiedComposerAttachmentHandlers";
import { useUnifiedComposerDraftStateLabelEffect } from "./unified-composer/useUnifiedComposerDraftStateLabelEffect";
import { useUnifiedComposerKeyboardShortcuts } from "./unified-composer/useUnifiedComposerKeyboardShortcuts";
import { useUnifiedComposerMediaUploadGate } from "./unified-composer/useUnifiedComposerMediaUploadGate";
import { useUnifiedComposerPublishTouchEffects } from "./unified-composer/useUnifiedComposerPublishTouchEffects";

export type { ContestEmbedPublishPayload };

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
   * When `embedContext` is `contest`, controls UI density. Defaults to `contest-lite`.
   * `contest-content` hides the publishing rail; the parent contest rail owns publish/schedule.
   * `source-post` is like `contest-content` with tighter spacing for campaign source step.
   */
  embeddedDensity?: "full" | "contest-lite" | "contest-content" | "source-post";
  /** Parent contest rail: now vs schedule (drives submit action when embedded). */
  contestRailLaunchMode?: "now" | "schedule";
  /** Syncs schedule time from contest rail into the composer form. */
  contestRailScheduledFor?: string | null;
  /** Exposes programmatic publish/schedule triggers for the contest primary CTA. */
  onEmbedActionsReady?: (api: {
    publishNow: () => void;
    schedulePost: () => void;
  }) => void;
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
  /** Template edit: preformatted "Updated" line for the template rail */
  templateLastUpdatedLabel?: string | null;
  /** Template edit: opens delete confirmation (parent owns dialog) */
  onTemplateDeleteClick?: () => void;
  composerContext?: ComposerContext;
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
  contestRailLaunchMode,
  contestRailScheduledFor,
  onEmbedActionsReady,
  newPostContentTab,
  publishMode = "now",
  onPublishModeChange,
  onDraftStateLabelChange,
  onRelayClick,
  templateLastUpdatedLabel = null,
  onTemplateDeleteClick,
  composerContext = { mode: "create" },
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
  const isEditingExisting = composerContext.mode !== "create";
  const hidePublishingRail =
    embedContext === "contest" &&
    (embeddedDensity ?? "contest-lite") !== "full";
  const isContestSourcePostDensity =
    embedContext === "contest" && embeddedDensity === "source-post";
  const initialAttachmentsFromDraft = React.useMemo(() => {
    const meta = initialDraft?.draftMeta?.attachmentMeta;
    if (!meta?.length) return [];
    return meta.map((a) => ({
      localId: a.localId,
      url: a.url,
      status: "done" as const,
      alt: a.alt,
      source: "existing" as const,
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
    threadAutoNumberSegments,
    setThreadAutoNumberSegments,
    draggingOverSegmentId,
    setDraggingOverSegmentId,
  } = composerState;

  const mergeThreadSegments = useCallback(
    (
      updater: React.SetStateAction<
        Array<{
          id: string;
          content: string;
          attachments: ComposerAttachment[];
        }>
      >
    ) => {
      setThreadSegments((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (!threadAutoNumberSegments) return next;
        return applyThreadSegmentNumberingToSegments(next);
      });
    },
    [threadAutoNumberSegments, setThreadSegments]
  );

  const handleThreadAutoNumberSegmentsChange = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        setThreadAutoNumberSegments(true);
        setThreadSegments((prev) =>
          applyThreadSegmentNumberingToSegments(prev)
        );
        return;
      }
      setThreadAutoNumberSegments(false);
      setThreadSegments((prev) =>
        prev.map((s) => ({
          ...s,
          content: stripLeadingThreadSegmentNumber(s.content),
        }))
      );
    },
    [setThreadAutoNumberSegments, setThreadSegments]
  );

  const alsoScheduleRepost = repostDelayList.length > 0;
  const alsoScheduleQuote = quoteEntries.length > 0;

  const {
    blossomMediaBlocked,
    blossomSignerMediaNote,
    attachmentFailedTitleHint,
  } = useUnifiedComposerMediaUploadGate(signerReady, windowNostrBridgePresent);

  const [publishAttempted, setPublishAttempted] = useState(false);
  const [composerTouched, setComposerTouched] = useState(false);

  React.useEffect(() => {
    if (!newPostContentTab) return;
    setIsThreadMode(newPostContentTab === "thread");
  }, [newPostContentTab, setIsThreadMode]);

  const tags: string[] = [];

  const form = useZodForm(textPostClientSchema, {
    defaultValues: {
      content: stripAttachmentTokens(initialDraft?.content ?? ""),
      scheduledFor: initialScheduledFor ?? "",
      queueType: initialDraft?.queueType ?? "unassigned",
      isRecyclable: false,
      useHashtagPresets: !!initialDraft?.hashTagPresetId,
      hashTagPresetId:
        initialDraft?.hashTagPresetId ?? selectedHashTagPresetId ?? undefined,
      includeHashtagsInNoteBody: defaultIncludeHashtagsForQueueSelection(
        initialDraft?.queueType ?? "unassigned",
        queueTypes
      ),
    },
  });

  const content = form.watch("content");
  const hasPostPreviewContent = useMemo(() => {
    const t = String(content).trim();
    return t.length > 0 || attachments.some((a) => Boolean(a.url));
  }, [content, attachments]);
  const skipEmptyPostPreview =
    isContestSourcePostDensity && !isThreadMode && !hasPostPreviewContent;
  const includeHashtagsInNoteBody = form.watch("includeHashtagsInNoteBody");
  const formSelectedHashtagPresetId = form.watch("hashTagPresetId");
  const useHashtagPresetsActive = !!form.watch("useHashtagPresets");

  const {
    processNewFilesForSingleNote,
    processNewFilesForSegment,
    handleAddAttachment,
    onFileChange,
    handleRemoveAttachment,
    handleReorderAttachments,
    handleRetryAttachment,
  } = useUnifiedComposerAttachmentHandlers({
    blossomMediaBlocked,
    setAttachments,
    mergeThreadSegments,
    isThreadMode,
    threadSegments,
    fileInputRef,
  });

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
      content: stripAttachmentTokens(localRestored.content),
      scheduledFor: localRestored.scheduledFor,
      queueType: localRestored.queueType,
      isRecyclable: false,
      useHashtagPresets: !!localRestored.hashTagPresetId,
      hashTagPresetId: localRestored.hashTagPresetId ?? undefined,
      includeHashtagsInNoteBody:
        localRestored.includeHashtagsInNoteBody !== undefined
          ? localRestored.includeHashtagsInNoteBody !== false
          : defaultIncludeHashtagsForQueueSelection(
              localRestored.queueType,
              queueTypes
            ),
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
      const threadNumbering = localRestored.threadAutoNumberSegments === true;
      setThreadAutoNumberSegments(threadNumbering);
      const mapped = localRestored.threadSegments.map((segment) => ({
        id: segment.id,
        content: stripAttachmentTokens(segment.content),
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
      setThreadSegments(
        threadNumbering ? applyThreadSegmentNumberingToSegments(padded) : padded
      );
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
    setThreadAutoNumberSegments,
    queueTypes,
  ]);

  const composerQueueDefaultEffectFirstRef = React.useRef(true);
  React.useEffect(() => {
    if (composerQueueDefaultEffectFirstRef.current) {
      composerQueueDefaultEffectFirstRef.current = false;
      return;
    }
    form.setValue(
      "includeHashtagsInNoteBody",
      defaultIncludeHashtagsForQueueSelection(selectedQueue, queueTypes)
    );
  }, [selectedQueue, queueTypes, form]);

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

  React.useEffect(() => {
    if (embedContext !== "contest" || contestRailScheduledFor == null) return;
    form.setValue("scheduledFor", contestRailScheduledFor);
    setSchedulingScheduledFor(contestRailScheduledFor);
  }, [contestRailScheduledFor, embedContext, form, setSchedulingScheduledFor]);

  const prevPublishModeRef = React.useRef(publishMode);
  React.useEffect(() => {
    const prev = prevPublishModeRef.current;
    prevPublishModeRef.current = publishMode;
    if (prev !== "queue" || publishMode === "queue") return;

    setSelectedQueue("unassigned");
    if (
      embedContext === "contest" &&
      contestRailScheduledFor != null &&
      contestRailScheduledFor.trim() !== ""
    ) {
      setSchedulingScheduledFor(contestRailScheduledFor);
      form.setValue("scheduledFor", contestRailScheduledFor);
    } else {
      setSchedulingScheduledFor("");
      form.setValue("scheduledFor", "");
    }
  }, [
    contestRailScheduledFor,
    embedContext,
    form,
    publishMode,
    setSchedulingScheduledFor,
    setSelectedQueue,
  ]);

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
        threadAutoNumberSegments: isThreadMode
          ? threadAutoNumberSegments
          : undefined,
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
      threadAutoNumberSegments,
    ]
  );
  const [initialFingerprint] = useState(() => composerDraftFingerprint);

  const hasUnsavedChanges =
    initialFingerprint !== composerDraftFingerprint && fetcher.state === "idle";

  React.useEffect(() => {
    const shouldWarn = hasUnsavedChanges && composerContext.mode !== "create";
    if (!shouldWarn) return;
    const guardMessage = "You have unsaved changes. Leave without saving?";
    const guardedUrl = window.location.href;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const clickHandler = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.origin !== currentUrl.origin) return;
      const noChange =
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash;
      if (noChange) return;
      if (!window.confirm(guardMessage)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const popStateHandler = () => {
      if (window.confirm(guardMessage)) return;
      window.history.pushState(window.history.state, "", guardedUrl);
    };
    window.addEventListener("beforeunload", handler);
    document.addEventListener("click", clickHandler, true);
    window.addEventListener("popstate", popStateHandler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      document.removeEventListener("click", clickHandler, true);
      window.removeEventListener("popstate", popStateHandler);
    };
  }, [hasUnsavedChanges, composerContext.mode]);

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
      includeHashtagsInNoteBody: includeHashtagsInNoteBody !== false,
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
      threadAutoNumberSegments: isThreadMode
        ? threadAutoNumberSegments
        : undefined,
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
    includeHashtagsInNoteBody,
    attachments,
    isThreadMode,
    threadSegments,
    threadDelayMinutes,
    threadAutoNumberSegments,
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

  const contestSubmitMode: ComposerPublishMode =
    embedContext === "contest"
      ? (contestRailLaunchMode ?? "now") === "schedule"
        ? "schedule"
        : "now"
      : publishMode;

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
    initialAttachmentMeta: initialDraft?.draftMeta?.attachmentMeta ?? [],
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
        }
      : null,
    defaultTags: tags,
    submitAction: formAction,
    embedContext,
    publishMode: contestSubmitMode,
    calculateQueueScheduleTime,
    onBeginSaveDraft,
    composerContext,
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

  const disabled = fetcher.state !== "idle" || isSigning;
  const primarySubmitRef = useRef<HTMLButtonElement>(null);
  const draftSubmitRef = useRef<HTMLButtonElement>(null);

  const hasScheduleTimeForSubmit = !!(
    typeof (formScheduledFor ?? schedulingScheduledFor) === "string" &&
    (formScheduledFor ?? schedulingScheduledFor).trim()
  );

  const relayCount =
    relayCountProp > 0
      ? relayCountProp
      : relayOverride && relayOverride.length > 0
        ? relayOverride.length
        : relayCountProp;

  const { hardBlockers, deferrableBlockers } =
    buildUnifiedComposerHardAndDeferrableBlockers({
      isTemplateMode,
      canSubmit,
      signerReady,
      embedContext,
      contestSubmitMode,
      publishMode,
      hasScheduleTimeForSubmit,
      selectedQueue,
      isThreadMode,
      threadSegmentsLength: threadSegments.length,
      hasContent,
      relayCount,
      content,
      threadSegments,
      attachmentsLength: attachments.length,
      attachments,
    });

  const issueList = [...hardBlockers, ...deferrableBlockers];

  const templateRailWarnings = buildUnifiedComposerTemplateRailWarnings({
    isTemplateMode,
    isThreadMode,
    threadSegments,
    content,
    attachmentsLength: attachments.length,
  });

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

  const publishModeForRail =
    embedContext === "contest" ? contestSubmitMode : publishMode;
  const readinessForRail =
    displayRedIssues.length > 0
      ? getReadinessPresentation(
          publishModeForRail,
          displayRedIssues,
          signerReady
        )
      : displayAmberIssues.length > 0
        ? ({
            tone: "warn",
            headline: "Missing requirements",
          } as const)
        : getReadinessPresentation(publishModeForRail, [], signerReady);

  useUnifiedComposerPublishTouchEffects(
    issueList.length,
    publishAttempted,
    setPublishAttempted,
    content,
    attachments.length,
    selectedHashtags,
    isThreadMode,
    threadSegments,
    setComposerTouched,
    publishMode,
    selectedQueue,
    formScheduledFor,
    schedulingScheduledFor
  );

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
        ...(threadAutoNumberSegments
          ? ["Segment numbers in note text: on"]
          : []),
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
    publishMode: publishModeForRail,
    relayCount,
    signerReady,
    scheduledFor:
      (formScheduledFor ?? "").trim() !== ""
        ? (formScheduledFor ?? "")
        : schedulingScheduledFor,
    hasScheduleTime: hasScheduleTimeForSubmit,
    selectedQueue,
    queueNextSlotLabel:
      publishModeForRail === "queue" ? queueNextSlotLabel : null,
  });

  const followUpSummaryLine = buildFollowUpCollapsedSummary({
    repostCount: repostDelayList.length,
    quoteCount: quoteEntries.length,
    conditionRuleCount: countRepostConditionRules(repostConditions),
  });

  const primaryActionLoading = fetcher.state !== "idle" || isSigning;

  useUnifiedComposerKeyboardShortcuts(
    disabled,
    signerReady,
    isTemplateMode,
    primarySubmitRef,
    draftSubmitRef
  );

  useUnifiedComposerDraftStateLabelEffect(
    fetcher,
    onDraftStateLabelChange,
    pendingExplicitSaveDraftRef,
    fetcherWasBusyRef,
    composerDraftFingerprint,
    serverDraftSavedBaseline,
    setServerDraftSavedBaseline,
    initialDraftId,
    skipLocalDraftRestore,
    draftPickerNavigateBase,
    navigate
  );

  const primarySubmitAction = isTemplateMode
    ? "save-as-template"
    : composerContext.mode === "edit_draft"
      ? "update-draft"
      : composerContext.mode === "edit_scheduled"
        ? "update-scheduled"
        : composerContext.mode === "edit_follow_up"
          ? "update-follow-up"
          : getTextSubmitActionForMode(
              embedContext === "contest" ? contestSubmitMode : publishMode
            );

  React.useLayoutEffect(() => {
    if (!embedContext || !onEmbedActionsReady) return;
    onEmbedActionsReady({
      publishNow: () => primarySubmitRef.current?.click(),
      schedulePost: () => primarySubmitRef.current?.click(),
    });
  }, [embedContext, onEmbedActionsReady, contestSubmitMode]);

  const openDraftPicker = (mode: "drafts" | "templates") => {
    setDraftPicker({ open: true, mode });
  };

  const composerHeaderTrailing =
    !isTemplateMode && !suppressBuiltInDraftPicker ? (
      <UnifiedComposerDraftHeaderTrailing
        disabled={disabled}
        draftTemplatesPickerEnabled={draftTemplatesPickerEnabled}
        onOpenDrafts={() => openDraftPicker("drafts")}
        onOpenTemplates={() => openDraftPicker("templates")}
      />
    ) : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-6 lg:flex-row lg:items-start",
        isContestSourcePostDensity && "gap-4"
      )}
    >
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
        {isEditingExisting ? (
          <input
            type="hidden"
            name="composerMode"
            value={composerContext.mode}
          />
        ) : null}
        {composerContext.mode === "edit_draft" ? (
          <input type="hidden" name="draftId" value={composerContext.draftId} />
        ) : null}
        {composerContext.mode === "edit_scheduled" ? (
          <input
            type="hidden"
            name="scheduledActionId"
            value={composerContext.scheduledActionId}
          />
        ) : null}
        {composerContext.mode === "edit_follow_up" ? (
          <>
            <input
              type="hidden"
              name="followUpActionId"
              value={composerContext.followUpActionId}
            />
            {composerContext.parentActionId ? (
              <input
                type="hidden"
                name="parentActionId"
                value={composerContext.parentActionId}
              />
            ) : null}
          </>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          aria-hidden
          disabled={blossomMediaBlocked}
          onChange={onFileChange}
        />
        {!isTemplateMode ? (
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
        ) : null}
        <UnifiedComposerThreadPartialSignDialog
          open={partialThreadState !== null}
          threadSegmentCount={threadSegments.length}
          partialThreadState={partialThreadState}
          onOpenChange={(open) => {
            if (!open) cancelSigningState();
          }}
          onCancelSigning={cancelSigningState}
          onRetryThreadFailed={retryThreadFailed}
          onSubmitThreadSuccessfulOnly={submitThreadSuccessfulOnly}
        />
        <div className={cn("mb-4", isContestSourcePostDensity && "mb-2")}>
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
              onRetryAttachment={handleRetryAttachment}
              onAddAttachment={handleAddAttachment}
              onReorderAttachments={handleReorderAttachments}
              onFilesDroppedSingle={processNewFilesForSingleNote}
              threadSegments={threadSegments}
              onThreadSegmentsChange={mergeThreadSegments}
              threadAutoNumberSegments={threadAutoNumberSegments}
              onThreadAutoNumberSegmentsChange={
                handleThreadAutoNumberSegmentsChange
              }
              threadDelayMinutes={threadDelayMinutes}
              onFilesDroppedSegment={processNewFilesForSegment}
              onThreadSegmentFileClick={(segmentId) => {
                if (blossomMediaBlocked) return;
                (
                  window as unknown as { __threadSegmentId?: string }
                ).__threadSegmentId = segmentId;
                document.getElementById("thread-segment-file-input")?.click();
              }}
              draggingOverSegmentId={draggingOverSegmentId}
              onDraggingOverSegmentIdChange={setDraggingOverSegmentId}
              blossomSignerMediaNote={blossomSignerMediaNote}
              attachmentFailedTitleHint={attachmentFailedTitleHint}
              mediaUploadDisabled={blossomMediaBlocked}
              contentDensity={
                isContestSourcePostDensity ? "campaignSource" : "default"
              }
              mediaCompact={isContestSourcePostDensity}
            />
            {!isTemplateMode ? (
              <>
                {!skipEmptyPostPreview ? (
                  <>
                    <ComposerCanvasDivider />
                    <div
                      className={cn(
                        "flex flex-col",
                        isContestSourcePostDensity
                          ? "gap-2 sm:gap-3"
                          : "gap-4 sm:gap-5"
                      )}
                    >
                      <UnifiedComposerPreviewBlock
                        isThreadMode={isThreadMode}
                        content={content}
                        attachments={attachments}
                        selectedHashtags={selectedHashtags}
                        useHashtagPresets={useHashtagPresetsActive}
                        queueTypes={queueTypes}
                        userId={user?.id}
                        defaultTags={tags}
                        includeHashtagsInNoteBody={
                          includeHashtagsInNoteBody !== false
                        }
                        threadSegments={threadSegments}
                        threadDelayMinutes={threadDelayMinutes}
                        selectedQueue={selectedQueue}
                        hideEmptyPreview={isContestSourcePostDensity}
                      />
                    </div>
                  </>
                ) : null}
                <ComposerCanvasDivider />
                <div
                  className={
                    isContestSourcePostDensity
                      ? "flex flex-col gap-2 sm:gap-2.5"
                      : "flex flex-col gap-4 sm:gap-5"
                  }
                >
                  <UnifiedComposerTagsSection
                    isContestSourcePostDensity={isContestSourcePostDensity}
                    selectedHashtags={selectedHashtags}
                    setSelectedHashtags={setSelectedHashtags}
                    hashTagPresets={hashTagPresets}
                    formSelectedHashtagPresetId={formSelectedHashtagPresetId}
                    form={form}
                    onHashtagPresetChange={onHashtagPresetChange}
                    fetcherIdle={fetcher.state === "idle"}
                    includeHashtagsInNoteBody={includeHashtagsInNoteBody}
                    selectedQueue={selectedQueue}
                    queueTypes={queueTypes}
                  />
                </div>
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
          disabled={blossomMediaBlocked}
          onChange={(e) => {
            const segmentId = (
              window as unknown as { __threadSegmentId?: string }
            ).__threadSegmentId;
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            if (!segmentId || files.length === 0) return;
            if (blossomMediaBlocked) return;
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
      {!hidePublishingRail && isTemplateMode ? (
        <UnifiedComposerTemplateSettingsRail
          isThreadMode={isThreadMode}
          templateName={templateName}
          templateLastUpdatedLabel={templateLastUpdatedLabel}
          threadSegmentsLength={threadSegments.length}
          threadCharCount={threadCharCount}
          threadMediaCount={threadMediaCount}
          repostDelayListLength={repostDelayList.length}
          quoteEntriesLength={quoteEntries.length}
          contentLength={content.length}
          attachmentsLength={attachments.length}
          isRecyclableVal={isRecyclableVal}
          templateRailWarnings={templateRailWarnings}
          primaryActionLoading={primaryActionLoading}
          primarySubmitDisabled={
            disabled || !templateName.trim() || issueList.length > 0
          }
          editTemplateContext={editTemplateContext}
          onSaveTemplate={() => primarySubmitRef.current?.click()}
          onTemplateDeleteClick={onTemplateDeleteClick}
          disabled={disabled}
        />
      ) : null}
      {!hidePublishingRail && !isTemplateMode ? (
        <UnifiedComposerPublishingSummaryRail
          publishMode={publishMode}
          onPublishModeChange={onPublishModeChange ?? (() => void 0)}
          outcomeSentence={outcomeSentence}
          readinessForRail={readinessForRail}
          composerStatus={composerStatus}
          relayCount={relayCount}
          signerReady={signerReady}
          signerLabel={signerLabel}
          handleRelayRailClick={handleRelayRailClick}
          queueTypes={queueTypes}
          selectedQueue={selectedQueue}
          setSelectedQueue={setSelectedQueue}
          disabled={disabled}
          form={form as UseFormReturn<TextPostFormData>}
          formScheduledFor={formScheduledFor}
          schedulingScheduledFor={schedulingScheduledFor}
          setSchedulingScheduledFor={setSchedulingScheduledFor}
          scheduleIntervals={scheduleIntervals}
          handleScheduleIntervalClick={handleScheduleIntervalClick}
          calculateQueueScheduleTime={calculateQueueScheduleTime}
          scheduleRandomWindowMinutes={scheduleRandomWindowMinutes}
          setScheduleRandomWindowMinutes={setScheduleRandomWindowMinutes}
          userTimezone={user?.timezone ?? "UTC"}
          selectedQueueType={selectedQueueType}
          repostDelayList={repostDelayList}
          setRepostDelayList={setRepostDelayList}
          repostConditions={repostConditions}
          setRepostConditions={setRepostConditions}
          quoteEntries={quoteEntries}
          setQuoteEntries={setQuoteEntries}
          followUpSummaryLine={followUpSummaryLine}
          postStatusSummaryInline={postStatusSummaryInline}
          publishSummaryTagsLine={publishSummaryTagsLine}
          isRecyclableVal={isRecyclableVal}
          contentSummaryLines={contentSummaryLines}
          publishPath={publishPath}
          isThreadMode={isThreadMode}
          threadDelayMinutes={threadDelayMinutes}
          setThreadDelayMinutes={setThreadDelayMinutes}
          setComposerTouched={setComposerTouched}
          threadSettingsLines={threadSettingsLines}
          displayRedIssues={displayRedIssues}
          displayAmberIssues={displayAmberIssues}
          pristineHint={pristineHint}
          idleStatusLabel={idleStatusLabel}
          primaryActionLoading={primaryActionLoading}
          issueListLength={issueList.length}
          primarySubmitRef={primarySubmitRef}
          draftSubmitRef={draftSubmitRef}
          onPrimaryActionBlocked={() => setPublishAttempted(true)}
          composerContext={composerContext}
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
