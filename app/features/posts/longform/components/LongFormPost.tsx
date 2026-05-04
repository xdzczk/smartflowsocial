import { useFetcher } from "@remix-run/react";
import { Hash } from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { buildFollowUpCollapsedSummary } from "~/features/posts/components/follow-up";
import { useComposerState, useLocalDraft } from "~/features/posts/composer";
import {
  buildArticlePublishSummaryLines,
  buildPublishPathSummary,
  buildPublishingOutcomeSentence,
  ComposerCanvasSectionLabel,
  ComposerLeftCanvas,
  getQueueNextSlotLabel,
  getReadinessPresentation,
  resolveComposerIssueDisplayPhase,
} from "~/features/posts/composer/components/composer";
import { useLongFormSubmission } from "~/features/posts/hooks/useLongFormSubmission";
import type { LongformQuoteEntry } from "~/features/posts/hooks/useLongFormSubmission";
import { useScheduleOverlapWarning } from "~/features/posts/scheduling/hooks/useScheduleOverlapWarning";
import { useCoverImageUpload } from "~/features/posts/useCoverImageUpload";
import { useLongFormEditor } from "~/features/posts/useLongFormEditor";
import { useLongFormScheduling } from "~/features/posts/useLongFormScheduling";
import { useBlossomUploadGate } from "~/features/upload/blossom-upload-gate-hook";
import { useSignAttemptProgress } from "~/lib/hooks/useSignAttemptProgress";
import {
  SMALL_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { stripMarkdownToPlainText } from "~/lib/markdown-utils";
import { cn } from "~/lib/utils";
import { longformPostClientSchema } from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

import {
  type QueueType as PostsQueueType,
  defaultIncludeHashtagsForQueueSelection,
} from "../../types";

import {
  LongFormPostArticleHead,
  LongFormPostSigningProgress,
  LongFormPostSummaryRails,
  useLongFormPostDraftStateLabelEffect,
  type LongFormHashTagPreset,
  type LongFormPostProps,
} from "./longform-post";
import { LongFormContentEditor } from "./LongFormContentEditor";

function normalizeWatchedText(value: string | undefined): string {
  return value ?? "";
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- Longform composer intentionally composes editor, scheduling, drafts, and publish flows in one orchestrator component. */
export default function LongFormPost({
  queueTypes = [],
  scheduleIntervals = [],
  userTags = "",
  uploadProvider = null,
  userTimezone = "UTC",
  onQueueTypeChange,
  onPreview,
  initialData = null,
  isEditing: _isEditing = false,
  hashTagPresets = [],
  useHashtagPresets = false,
  selectedHashtagPresetId = null,
  selectedHashtags = "",
  onUseHashtagPresetsChange,
  onHashtagPresetChange,
  mode = "default",
  editTemplateContext = null,
  initialTemplateName = null,
  initialScheduledFor = null,
  skipLocalDraftRestore = false,
  publishMode = "now",
  onPublishModeChange,
  onDraftStateLabelChange,
  defaultRelays = [],
  relayOverride: relayOverrideProp,
  onRelayClick,
  templateLastUpdatedLabel = null,
  onTemplateDeleteClick,
  onPublishIntent,
}: LongFormPostProps) {
  const { mediaUploadBlocked } = useBlossomUploadGate();
  const fetcher = useFetcher();
  const pendingLongformSaveDraftRef = useRef(false);
  const longformFetcherWasBusyRef = useRef(false);
  const [longformDraftSavedBaseline, setLongformDraftSavedBaseline] = useState<
    string | null
  >(null);
  const [serverLongFormPostId, setServerLongFormPostId] = useState<
    string | null
  >(() => initialData?.id ?? null);

  useEffect(() => {
    setServerLongFormPostId(initialData?.id ?? null);
  }, [initialData?.id]);

  const [templateName, setTemplateName] = useState(
    () => initialTemplateName ?? ""
  );
  const [publishAttempted, setPublishAttempted] = useState(false);
  const [composerTouched, setComposerTouched] = useState(false);
  const [bodyView, setBodyView] = useState<"edit" | "preview">("edit");
  const isTemplateMode = mode === "template";
  const [quoteEntries, setQuoteEntries] = useState<LongformQuoteEntry[]>([]);

  // Initialize form with React Hook Form
  const form = useZodForm(longformPostClientSchema, {
    defaultValues: {
      title: initialData?.title ?? "",
      summary: initialData?.summary ?? "",
      content: initialData?.content ?? "",
      customTags: initialData?.tags?.join(", ") ?? "",
      scheduledFor: initialScheduledFor ?? "",
      queueType: initialData?.queueType?.name ?? "unassigned",
      useHashtagPresets: useHashtagPresets,
      hashTagPresetId: selectedHashtagPresetId ?? undefined,
      includeHashtagsInNoteBody: defaultIncludeHashtagsForQueueSelection(
        initialData?.queueType?.name ?? "unassigned",
        queueTypes as Array<string | PostsQueueType>
      ),
    },
  });

  // Watch form values
  const title = normalizeWatchedText(form.watch("title"));
  const summary = normalizeWatchedText(form.watch("summary"));
  const content = normalizeWatchedText(form.watch("content"));
  const customTags = normalizeWatchedText(form.watch("customTags"));
  const includeHashtagsInNoteBody = form.watch("includeHashtagsInNoteBody");

  const relayOverride =
    relayOverrideProp && relayOverrideProp.length > 0
      ? relayOverrideProp
      : null;
  const relayCount =
    relayOverride != null
      ? relayOverride.length
      : Math.max(0, defaultRelays.length);

  // Use extracted hooks (Tiptap; markdown synced via debounce + flushSync)
  const {
    editor,
    editorReady,
    loadInitialData,
    generateSummaryFromContent,
    flushSync,
  } = useLongFormEditor({
    uploadProvider,
    initialMarkdown: initialData?.content ?? "",
    onContentChange: (newContent) =>
      form.setValue("content", newContent, { shouldValidate: true }),
  });

  const {
    image: coverImage,
    setImage: setCoverImage,
    uploadError,
    uploadFetcherState,
    handleImageUpload,
    handleFetcherData,
    handleFetcherStateChange,
  } = useCoverImageUpload({
    uploadProvider,
    initialImage: initialData?.image ?? "",
    mediaUploadBlocked,
  });

  // Sync cover image with form (image field is not in schema, but we'll manage it separately)
  // Note: The schema doesn't include image, but we need it for validation
  // We'll handle it separately since it's managed by useCoverImageUpload
  const image = coverImage;

  const {
    selectedQueueType: schedulingQueueType,
    scheduledFor: schedulingScheduledFor,
    setScheduledFor: setSchedulingScheduledFor,
    displayedHashtags,
    updateDisplayedHashtags,
    handleScheduleIntervalClick,
    calculateQueueScheduleTime,
  } = useLongFormScheduling({
    queueTypes,
    scheduleIntervals,
    userTags,
    userTimezone,
    initialQueueType: initialData?.queueType?.name ?? "unassigned",
    onQueueTypeChange,
  });

  const appliedInitialScheduledRef = useRef(false);
  useEffect(() => {
    if (
      !initialScheduledFor ||
      initialData ||
      appliedInitialScheduledRef.current
    )
      return;
    appliedInitialScheduledRef.current = true;
    setSchedulingScheduledFor(initialScheduledFor);
  }, [initialScheduledFor, initialData, setSchedulingScheduledFor]);

  const prevLongformPublishModeRef = useRef(publishMode);
  useEffect(() => {
    const prev = prevLongformPublishModeRef.current;
    prevLongformPublishModeRef.current = publishMode;
    if (prev !== "queue" || publishMode === "queue") return;
    void updateDisplayedHashtags("unassigned");
    setSchedulingScheduledFor(null);
    form.setValue("scheduledFor", "");
    form.setValue("queueType", "unassigned");
  }, [form, publishMode, setSchedulingScheduledFor, updateDisplayedHashtags]);

  const longformDraftKey =
    initialData?.id != null
      ? `longform-draft-${initialData.id}`
      : "longform-draft-new";
  const {
    restored: longformRestored,
    saveSnapshot: saveLongformSnapshot,
    flushSnapshot: flushLongformSnapshot,
    clearSnapshot: clearLongformSnapshot,
  } = useLocalDraft<{
    title: string;
    summary: string;
    content: string;
    image: string;
    customTags: string;
    queueType: string;
    savedAt: number;
  }>(longformDraftKey, !!initialData || skipLocalDraftRestore, 2000);
  const lastLongformSnapshotRef = useRef<{
    title: string;
    summary: string;
    content: string;
    image: string;
    customTags: string;
    queueType: string;
  } | null>(null);

  const appliedLongformRestoredRef = useRef(false);
  useEffect(() => {
    if (
      !longformRestored ||
      initialData ||
      skipLocalDraftRestore ||
      appliedLongformRestoredRef.current
    )
      return;
    appliedLongformRestoredRef.current = true;
    form.reset({
      title: longformRestored.title,
      summary: longformRestored.summary,
      content: longformRestored.content,
      customTags: longformRestored.customTags,
      scheduledFor: "",
      queueType: longformRestored.queueType,
      useHashtagPresets: false,
      hashTagPresetId: undefined,
    });
    setCoverImage(longformRestored.image || "");
    if (editorReady && editor && longformRestored.content) {
      loadInitialData(longformRestored.content);
    }
    setSchedulingScheduledFor("");
    void updateDisplayedHashtags(longformRestored.queueType);
  }, [
    longformRestored,
    initialData,
    skipLocalDraftRestore,
    form,
    editorReady,
    editor,
    loadInitialData,
    setCoverImage,
    setSchedulingScheduledFor,
    updateDisplayedHashtags,
  ]);

  // When editor mounts after we already applied restored snapshot, load form content into editor (once)
  const editorRestoreLoadedRef = useRef(false);
  useEffect(() => {
    if (
      initialData ||
      !editorReady ||
      !editor ||
      !appliedLongformRestoredRef.current ||
      editorRestoreLoadedRef.current
    )
      return;
    const formContent = form.getValues("content");
    if (formContent && typeof formContent === "string") {
      editorRestoreLoadedRef.current = true;
      loadInitialData(formContent);
    }
  }, [initialData, editorReady, editor, form, loadInitialData]);

  useEffect(() => {
    if (initialData || skipLocalDraftRestore) return;
    const snapshot = {
      /* eslint-disable @typescript-eslint/no-unnecessary-condition -- form state can be undefined */
      title: title ?? "",
      summary: summary ?? "",
      content: content ?? "",
      image: image ?? "",
      customTags: customTags ?? "",
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      queueType: schedulingQueueType,
    };
    lastLongformSnapshotRef.current = snapshot;
    saveLongformSnapshot(snapshot);
  }, [
    initialData,
    skipLocalDraftRestore,
    title,
    summary,
    content,
    image,
    customTags,
    schedulingQueueType,
    saveLongformSnapshot,
  ]);

  // Flush localStorage on unmount and when page is hidden; use current state at flush time so last keystroke is not lost
  useEffect(() => {
    if (initialData || skipLocalDraftRestore) return;
    const flush = () => {
      /* eslint-disable @typescript-eslint/no-unnecessary-condition -- snapshot fields must be string for JSON; form.watch() can be undefined */
      const snap = {
        title: title ?? "",
        summary: summary ?? "",
        content: content ?? "",
        image: image ?? "",
        customTags: customTags ?? "",
        queueType: schedulingQueueType,
      };
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      flushLongformSnapshot(snap);
    };
    const onHide = () => flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [
    initialData,
    skipLocalDraftRestore,
    flushLongformSnapshot,
    title,
    summary,
    content,
    image,
    customTags,
    schedulingQueueType,
  ]);

  useEffect(() => {
    if (
      fetcher.state === "submitting" &&
      !initialData &&
      !skipLocalDraftRestore
    ) {
      clearLongformSnapshot();
    }
  }, [
    fetcher.state,
    initialData,
    skipLocalDraftRestore,
    clearLongformSnapshot,
  ]);

  // Sync scheduling hook with form (form is source of truth for submit; we push hook -> form)
  const formQueueTypeJustSetRef = useRef(false);
  useEffect(() => {
    formQueueTypeJustSetRef.current = true;
    form.setValue("queueType", schedulingQueueType);
  }, [schedulingQueueType, form]);

  const prevQueueForIncludeRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevQueueForIncludeRef.current === null) {
      prevQueueForIncludeRef.current = schedulingQueueType;
      return;
    }
    if (prevQueueForIncludeRef.current === schedulingQueueType) return;
    prevQueueForIncludeRef.current = schedulingQueueType;
    form.setValue(
      "includeHashtagsInNoteBody",
      defaultIncludeHashtagsForQueueSelection(
        schedulingQueueType,
        queueTypes as Array<string | PostsQueueType>
      )
    );
  }, [schedulingQueueType, queueTypes, form]);

  const scheduledForJustSetFromHookRef = useRef(false);
  useEffect(() => {
    if (schedulingScheduledFor) {
      scheduledForJustSetFromHookRef.current = true;
      form.setValue("scheduledFor", schedulingScheduledFor);
    }
  }, [schedulingScheduledFor, form]);

  // Sync form with scheduling hook (only when user changed the input, not when we just set form from hook)
  const formScheduledFor = form.watch("scheduledFor");
  const formQueueType = form.watch("queueType");
  useEffect(() => {
    if (scheduledForJustSetFromHookRef.current) {
      scheduledForJustSetFromHookRef.current = false;
      return;
    }
    if (formScheduledFor !== schedulingScheduledFor) {
      setSchedulingScheduledFor(formScheduledFor ?? null);
    }
  }, [formScheduledFor, schedulingScheduledFor, setSchedulingScheduledFor]);

  // Sync form -> scheduling only when user changed the dropdown (not when we just set form from hook)
  const prevFormQueueTypeRef = useRef(formQueueType);
  useEffect(() => {
    if (formQueueTypeJustSetRef.current) {
      formQueueTypeJustSetRef.current = false;
      prevFormQueueTypeRef.current = formQueueType;
      return;
    }
    const formChanged = prevFormQueueTypeRef.current !== formQueueType;
    prevFormQueueTypeRef.current = formQueueType;
    if (formChanged && formQueueType && formQueueType !== schedulingQueueType) {
      void updateDisplayedHashtags(formQueueType);
    }
  }, [formQueueType, schedulingQueueType, updateDisplayedHashtags]);

  const selectedQueueType = schedulingQueueType;
  const longformDraftFingerprint = useMemo(
    () =>
      JSON.stringify({
        title: title,
        summary: summary,
        content: content,
        image: image,
        customTags: customTags,
        queueType: schedulingQueueType,
      }),
    [title, summary, content, image, customTags, schedulingQueueType]
  );

  useEffect(() => {
    setLongformDraftSavedBaseline((prev) => {
      if (prev === null) return null;
      return prev === longformDraftFingerprint ? prev : null;
    });
  }, [longformDraftFingerprint]);

  const scheduledFor = schedulingScheduledFor ?? null;
  const selectedQueueTypeObj = queueTypes.find(
    (q) => (typeof q === "string" ? q : q.name) === selectedQueueType
  );
  const selectedQueueTypeId =
    selectedQueueTypeObj && typeof selectedQueueTypeObj === "object"
      ? selectedQueueTypeObj.id
      : null;
  const shouldCheckScheduleOverlap =
    Boolean(scheduledFor?.trim()) &&
    (publishMode === "schedule" || publishMode === "queue");
  const { warning: scheduleOverlapWarning } = useScheduleOverlapWarning({
    scheduledFor,
    queueTypeId: selectedQueueTypeId,
    enabled: shouldCheckScheduleOverlap,
    excludeContentId: initialData?.id ?? null,
  });

  const setScheduledFor = (value: string | null) => {
    if (value) {
      form.setValue("scheduledFor", value);
      setSchedulingScheduledFor(value);
    } else {
      form.setValue("scheduledFor", "");
      setSchedulingScheduledFor(null);
    }
  };

  // Handle upload fetcher responses
  useEffect(() => {
    handleFetcherData();
  }, [handleFetcherData]);

  // Clear upload errors when fetcher state changes
  useEffect(() => {
    handleFetcherStateChange();
  }, [handleFetcherStateChange]);

  // Initial content is set via initialMarkdown + key; loadInitialData for late-arriving data if needed
  useEffect(() => {
    if (editorReady && initialData?.content && editor) {
      const timeoutId = setTimeout(() => {
        loadInitialData(initialData.content!);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [editorReady, initialData?.content, loadInitialData, editor]);

  const handleGenerateSummary = () => {
    const generatedSummary = generateSummaryFromContent(content);
    if (generatedSummary) {
      form.setValue("summary", generatedSummary);
    }
  };

  /** Save draft via fetcher so Tiptap content (not in DOM form) is included */
  const handleSaveDraft = () => {
    flushSync();
    // Use getValues() after flushSync so we submit latest editor content (watch() would be stale)
    const values = form.getValues();
    const formData = new FormData();
    formData.set("_action", "save-draft");
    formData.set("contentType", "article");
    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- FormData.set expects string; values may be undefined at runtime */
    formData.set("title", values.title ?? "");
    formData.set("content", values.content ?? "");
    formData.set("summary", values.summary ?? "");
    formData.set("image", image ?? "");
    formData.set("customTags", values.customTags ?? "");
    formData.set("queueType", schedulingQueueType ?? "");
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */
    formData.set("useHashtagPresets", String(useHashtagPresets));
    formData.set("hashTagPresetId", selectedHashtagPresetId ?? "");
    formData.set(
      "includeHashtagsInNoteBody",
      String(Boolean(values.includeHashtagsInNoteBody))
    );
    if (serverLongFormPostId) {
      formData.set("longFormPostId", serverLongFormPostId);
    }
    pendingLongformSaveDraftRef.current = true;
    fetcher.submit(formData, { method: "post" });
  };

  const { handleSchedule, isSigning, signingError, cancelSigning } =
    useLongFormSubmission({
      /* eslint-disable @typescript-eslint/no-unnecessary-condition -- useLongFormSubmission expects string; form.watch() may be undefined */
      title: title ?? "",
      summary: summary ?? "",
      content: content ?? "",
      image,
      customTags: customTags ?? "",
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      selectedQueueType,
      scheduledFor,
      displayedHashtags,
      useHashtagPresets,
      selectedHashtags,
      alsoScheduleQuote: quoteEntries.length > 0,
      quoteEntries,
      userTimezone,
      publishMode,
      calculateQueueScheduleTime,
      relayOverride,
      includeHashtagsInNoteBody: Boolean(includeHashtagsInNoteBody),
      onPublishIntent,
    });
  const { signAttempt, signElapsedSeconds } = useSignAttemptProgress(isSigning);

  // Form validation using Zod
  const isFormValid = form.formState.isValid && !!image;

  const hasScheduleTimeLong =
    Boolean(scheduledFor) ||
    (publishMode === "queue" &&
      selectedQueueType !== "unassigned" &&
      selectedQueueType !== "Unassigned");

  const composerStatus = useComposerState({
    hasContent: Boolean(title.trim() && content.trim() && image),
    canSubmit: isFormValid,
    hasScheduleTime: hasScheduleTimeLong,
    isSigning,
    isSubmitting: fetcher.state !== "idle",
    publishSubmitInFlight: false,
    lastPublishFailed: false,
  });

  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) return;
    flushSync();
    const values = form.getValues();
    const formData = new FormData();
    formData.set("contentType", "article");
    if (editTemplateContext?.templateId && editTemplateContext.longFormPostId) {
      formData.set("_action", "updateTemplateLongform");
      formData.set("templateId", editTemplateContext.templateId);
      formData.set("longFormPostId", editTemplateContext.longFormPostId);
      formData.set("name", templateName.trim());
    } else {
      formData.set("_action", "createTemplate");
      formData.set("templateName", templateName.trim());
    }
    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- FormData.set expects string */
    formData.set("title", values.title ?? "");
    formData.set("summary", values.summary ?? "");
    formData.set("content", values.content ?? "");
    formData.set("image", image ?? "");
    formData.set("customTags", values.customTags ?? "");
    formData.set("queueType", "unassigned");
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */
    if (selectedHashtagPresetId)
      formData.set("hashTagPresetId", selectedHashtagPresetId);
    formData.set(
      "useHashtagPresets",
      String(Boolean(values.useHashtagPresets))
    );
    fetcher.submit(formData, { method: "post" });
  };

  // Word count from markdown (plain text)
  const wordCount = (() => {
    const c = content;
    if (!c || typeof c !== "string") return 0;
    const plain = stripMarkdownToPlainText(c);
    return plain.trim().split(/\s+/).filter(Boolean).length;
  })();

  useLongFormPostDraftStateLabelEffect(
    fetcher,
    onDraftStateLabelChange,
    pendingLongformSaveDraftRef,
    longformFetcherWasBusyRef,
    longformDraftFingerprint,
    longformDraftSavedBaseline,
    setLongformDraftSavedBaseline,
    setServerLongFormPostId,
    initialData,
    skipLocalDraftRestore
  );

  const deferrableBlockers: string[] = [];
  if (!isTemplateMode) {
    if (!title.trim()) deferrableBlockers.push("Article title is missing.");
    if (!content.trim()) deferrableBlockers.push("Article body is empty.");
    if (!image) deferrableBlockers.push("Article cover is missing.");
    if (publishMode === "schedule" && !scheduledFor) {
      deferrableBlockers.push("Select a date and time.");
    }
    if (
      publishMode === "queue" &&
      (selectedQueueType === "unassigned" || selectedQueueType === "Unassigned")
    ) {
      deferrableBlockers.push("Choose a queue.");
    }
    if (relayCount <= 0) {
      deferrableBlockers.push("Select at least one relay.");
    }
  }
  const issueList = deferrableBlockers;

  const templateRailWarnings: string[] = [];
  if (isTemplateMode) {
    if (!title.trim()) {
      templateRailWarnings.push("Template has no title yet.");
    }
    if (!content.trim()) {
      templateRailWarnings.push("Template body is empty.");
    }
    if (!image) {
      templateRailWarnings.push("No cover image set.");
    }
  }
  const issueDisplayPhase = resolveComposerIssueDisplayPhase(
    publishAttempted,
    composerTouched
  );
  const displayRedIssues =
    issueDisplayPhase === "blocking" ? [...deferrableBlockers] : [];
  const displayAmberIssues = [
    ...(issueDisplayPhase === "soft" ? [...deferrableBlockers] : []),
    ...(scheduleOverlapWarning ? [scheduleOverlapWarning] : []),
  ];
  const pristineHint =
    issueDisplayPhase === "pristine" && deferrableBlockers.length > 0
      ? "Add title, body, and cover. Then choose publish mode on the right."
      : undefined;
  const idleStatusLabel =
    issueDisplayPhase === "pristine" && deferrableBlockers.length > 0
      ? "Draft"
      : undefined;
  const readinessForRail =
    displayRedIssues.length > 0
      ? getReadinessPresentation(publishMode, displayRedIssues, true)
      : displayAmberIssues.length > 0
        ? ({
            tone: "warn",
            headline: "Missing requirements",
          } as const)
        : getReadinessPresentation(publishMode, [], true);
  const queueAssigned =
    selectedQueueType !== "unassigned" && selectedQueueType !== "Unassigned";

  const contentSummaryLines = buildArticlePublishSummaryLines({
    hasTitle: title.trim().length > 0,
    hasSummary: Boolean(summary.trim()),
    wordCount,
    hasCover: Boolean(image),
    customTags,
    relayCount,
    publishMode,
    hasScheduleTime: Boolean(scheduledFor?.trim()),
    queueAssigned,
  });
  const publishPath = buildPublishPathSummary(
    relayCount,
    "NIP-07",
    selectedQueueType
  );

  const longformQueueNextSlotLabel =
    publishMode === "queue" &&
    selectedQueueTypeObj &&
    typeof selectedQueueTypeObj === "object" &&
    (selectedQueueTypeObj.scheduleType === "FIXED_SLOTS" ||
      selectedQueueTypeObj.scheduleType === "WEEKLY_SLOTS")
      ? getQueueNextSlotLabel(scheduledFor ?? "")
      : undefined;

  const outcomeSentence = buildPublishingOutcomeSentence({
    publishMode,
    relayCount,
    signerReady: true,
    scheduledFor: scheduledFor ?? "",
    hasScheduleTime: Boolean(scheduledFor?.trim()),
    selectedQueue: selectedQueueType,
    queueNextSlotLabel: longformQueueNextSlotLabel,
    omitRelayRequirement: false,
  });

  const longformFollowUpSummary = buildFollowUpCollapsedSummary({
    repostCount: 0,
    quoteCount: quoteEntries.length,
    conditionRuleCount: 0,
  });

  const primaryActionLoading = fetcher.state !== "idle" || isSigning;

  const handleRelayRailClick = useCallback(() => {
    setComposerTouched(true);
    onRelayClick?.();
  }, [onRelayClick]);

  /** Template prefill (no id) → Preview; new blank, server id from props, or after first save → Save draft. */
  const secondaryIsSaveDraft =
    !initialData || initialData.id != null || serverLongFormPostId != null;

  useEffect(() => {
    if (issueList.length === 0 && publishAttempted) {
      setPublishAttempted(false);
    }
  }, [issueList.length, publishAttempted]);

  useEffect(() => {
    if (
      title.trim().length > 0 ||
      content.trim().length > 0 ||
      Boolean(image) ||
      customTags.trim().length > 0 ||
      summary.trim().length > 0
    ) {
      setComposerTouched(true);
    }
  }, [title, content, image, customTags, summary]);

  useEffect(() => {
    if (!initialData) {
      document
        .getElementById("article-composer-title")
        ?.focus({ preventScroll: true });
    }
  }, [initialData]);

  useEffect(() => {
    if (publishMode !== "now") setComposerTouched(true);
  }, [publishMode]);

  useEffect(() => {
    if (relayOverride && relayOverride.length > 0) setComposerTouched(true);
  }, [relayOverride]);

  useEffect(() => {
    if (
      selectedQueueType !== "unassigned" &&
      selectedQueueType !== "Unassigned"
    ) {
      setComposerTouched(true);
    }
  }, [selectedQueueType]);

  useEffect(() => {
    if (scheduledFor?.trim()) setComposerTouched(true);
  }, [scheduledFor]);

  const articleColumnClass = "mx-auto w-full max-w-[min(100%,42rem)]";
  const showArticleFooterStrip =
    isTemplateMode || isSigning || Boolean(signingError);
  const templateArticleSaveBusy =
    fetcher.state !== "idle" || uploadFetcherState !== "idle";

  const editPreviewToggle = (
    <div className="inline-flex gap-4" role="group" aria-label="Body view">
      <button
        type="button"
        className={cn(
          "motion-fast pb-1 text-[10px] font-medium tracking-wide",
          bodyView === "edit"
            ? "text-text/90 border-foreground/35 -mb-px border-b-2"
            : "text-text-secondary/55 hover:text-text-secondary/85 border-b-2 border-transparent"
        )}
        onClick={() => setBodyView("edit")}
        aria-pressed={bodyView === "edit"}
      >
        Edit
      </button>
      <button
        type="button"
        className={cn(
          "motion-fast pb-1 text-[10px] font-medium tracking-wide",
          bodyView === "preview"
            ? "text-text/90 border-foreground/35 -mb-px border-b-2"
            : "text-text-secondary/55 hover:text-text-secondary/85 border-b-2 border-transparent"
        )}
        onClick={() => {
          flushSync();
          setBodyView("preview");
        }}
        aria-pressed={bodyView === "preview"}
      >
        Preview
      </button>
    </div>
  );

  return (
    <>
      <div className="flex min-h-screen flex-col gap-6 lg:flex-row lg:items-start">
        <div className="mb-4 min-w-0 flex-1 lg:mb-0">
          <ComposerLeftCanvas>
            <div className={`${articleColumnClass} space-y-10`}>
              <LongFormPostArticleHead
                initialPostId={initialData?.id}
                title={title}
                summary={summary}
                content={content}
                form={
                  form as UseFormReturn<
                    z.infer<typeof longformPostClientSchema>
                  >
                }
                onGenerateSummary={handleGenerateSummary}
                image={image}
                uploadError={uploadError}
                uploadProvider={uploadProvider}
                uploadFetcherState={uploadFetcherState}
                onImageUpload={(e) => {
                  void handleImageUpload(e);
                }}
                onRemoveCover={() => setCoverImage("")}
                mediaUploadBlocked={mediaUploadBlocked}
                articleColumnClass="w-full min-w-0"
              />

              {/* Writing zone  -  continuous with headline stack */}
              <LongFormContentEditor
                key={initialData?.id ?? "new"}
                surface="editorial"
                containedInComposerCard
                uploadProvider={uploadProvider}
                onOpenAssetBrowser={() => {}}
                editorReady={editorReady}
                editor={editor}
                bodyView={bodyView}
                previewMarkdown={content}
                chromeLeading={editPreviewToggle}
              />

              {/* Finishing zone  -  tags & presets (secondary) */}
              <div className="space-y-3 pt-1">
                <div>
                  <ComposerCanvasSectionLabel
                    as="label"
                    className="mb-0"
                    htmlFor="article-composer-custom-tags"
                    tone="article"
                  >
                    Custom tags
                  </ComposerCanvasSectionLabel>
                  <Input
                    id="article-composer-custom-tags"
                    {...form.register("customTags")}
                    placeholder="e.g. bitcoin, nostr, technology"
                    className="border-border-subtle/55 bg-section/30 dark:bg-section/20 mt-1.5 text-sm shadow-none"
                  />
                </div>

                {!isTemplateMode && displayedHashtags ? (
                  <div className="cluster">
                    <Badge variant="secondary" className="text-xs">
                      <Hash
                        className={`mr-1 inline-block opacity-75 ${SMALL_ICON_SIZE_CLASS}`}
                        strokeWidth={INLINE_ICON_STROKE}
                        aria-hidden
                      />
                      {displayedHashtags}
                    </Badge>
                  </div>
                ) : null}

                <HashtagPresetToggle
                  presets={hashTagPresets}
                  selectedPresetId={selectedHashtagPresetId}
                  onSelect={
                    onHashtagPresetChange ??
                    ((_id, _tags) => {
                      void _id;
                      void _tags;
                    })
                  }
                  useHashtagPresets={useHashtagPresets}
                  onUseHashtagPresetsChange={
                    onUseHashtagPresetsChange ??
                    (() => {
                      void 0;
                    })
                  }
                  presentation="subdued"
                  showQueuePreset={true}
                  queueType={(() => {
                    const qt = queueTypes.find(
                      (q) =>
                        (typeof q === "string" ? q : q.name) ===
                        selectedQueueType
                    );
                    if (qt && typeof qt === "object" && qt.id) {
                      return qt as {
                        id: string;
                        name: string;
                        hashTagPreset?: LongFormHashTagPreset | null;
                      };
                    }
                    return null;
                  })()}
                />
                <input
                  type="hidden"
                  name="useHashtagPresets"
                  value={useHashtagPresets.toString()}
                />
                <input
                  type="hidden"
                  name="hashTagPresetId"
                  value={selectedHashtagPresetId ?? ""}
                />
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="min-w-0 space-y-0.5">
                    <Label
                      htmlFor="longform-include-tags-in-body"
                      className="text-text-secondary/75 text-[11px] leading-snug font-normal"
                    >
                      Hide tags
                    </Label>
                    <p className="text-text-secondary/50 text-[10px] leading-snug">
                      Off by default. Turn on to keep tags out of the article
                      text (event tags only).
                    </p>
                  </div>
                  <Switch
                    id="longform-include-tags-in-body"
                    checked={includeHashtagsInNoteBody === false}
                    onCheckedChange={(hide) => {
                      form.setValue("includeHashtagsInNoteBody", !hide);
                    }}
                    disabled={fetcher.state !== "idle"}
                    className="mt-0.5 shrink-0"
                  />
                </div>
                <input
                  type="hidden"
                  name="includeHashtagsInNoteBody"
                  value={String(Boolean(includeHashtagsInNoteBody))}
                />
              </div>
            </div>

            {showArticleFooterStrip ? (
              <>
                <div
                  className={`${articleColumnClass} border-border-subtle/35 mt-8 space-y-4 border-t pt-6`}
                >
                  {isTemplateMode ? (
                    <div className="space-y-2">
                      <Label htmlFor="template-name-longform">
                        Template name
                      </Label>
                      <Input
                        id="template-name-longform"
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="e.g. Weekly article"
                        className="max-w-xs"
                      />
                    </div>
                  ) : (
                    <LongFormPostSigningProgress
                      isSigning={isSigning}
                      signingError={signingError}
                      signAttempt={signAttempt}
                      signElapsedSeconds={signElapsedSeconds}
                      cancelSigning={cancelSigning}
                    />
                  )}
                </div>
              </>
            ) : null}
          </ComposerLeftCanvas>
        </div>
        <LongFormPostSummaryRails
          isTemplateMode={isTemplateMode}
          templateName={templateName}
          templateLastUpdatedLabel={templateLastUpdatedLabel}
          title={title}
          summary={summary}
          image={image}
          wordCount={wordCount}
          templateRailWarnings={templateRailWarnings}
          primaryActionLoading={primaryActionLoading}
          handleSaveAsTemplate={handleSaveAsTemplate}
          templateArticleSaveBusy={templateArticleSaveBusy}
          editTemplateContext={editTemplateContext}
          onTemplateDeleteClick={onTemplateDeleteClick}
          publishMode={publishMode}
          onPublishModeChange={onPublishModeChange}
          outcomeSentence={outcomeSentence}
          readinessForRail={readinessForRail}
          composerStatus={composerStatus}
          relayCount={relayCount}
          onRelayClick={onRelayClick}
          handleRelayRailClick={handleRelayRailClick}
          longformQueueNextSlotLabel={longformQueueNextSlotLabel}
          queueTypes={queueTypes}
          selectedQueueType={selectedQueueType}
          updateDisplayedHashtags={(name) => {
            const r = updateDisplayedHashtags(name);
            void r;
          }}
          scheduledFor={scheduledFor}
          setScheduledFor={setScheduledFor}
          scheduleIntervals={scheduleIntervals}
          handleScheduleIntervalClick={handleScheduleIntervalClick}
          calculateQueueScheduleTime={calculateQueueScheduleTime}
          hashTagPresets={hashTagPresets}
          useHashtagPresets={useHashtagPresets}
          selectedHashtagPresetId={selectedHashtagPresetId}
          selectedHashtags={selectedHashtags}
          onHashtagPresetChange={onHashtagPresetChange}
          onUseHashtagPresetsChange={onUseHashtagPresetsChange}
          userTimezone={userTimezone}
          longformFollowUpSummary={longformFollowUpSummary}
          quoteEntries={quoteEntries}
          setQuoteEntries={setQuoteEntries}
          fetcherState={fetcher.state}
          isSigning={isSigning}
          contentSummaryLines={contentSummaryLines}
          publishPath={publishPath}
          displayRedIssues={displayRedIssues}
          displayAmberIssues={displayAmberIssues}
          pristineHint={pristineHint}
          idleStatusLabel={idleStatusLabel}
          isFormValid={isFormValid}
          issueList={issueList}
          handleSchedule={(mode) => {
            const r = handleSchedule(mode);
            void r;
          }}
          setPublishAttempted={setPublishAttempted}
          generateSummaryFromContent={generateSummaryFromContent}
          content={content}
          onPreview={onPreview}
          secondaryIsSaveDraft={secondaryIsSaveDraft}
          handleSaveDraft={handleSaveDraft}
          flushSync={flushSync}
        />
      </div>
    </>
  );
}
