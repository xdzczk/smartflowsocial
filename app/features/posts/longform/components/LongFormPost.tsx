import { Link, useFetcher } from "@remix-run/react";
import { Hash } from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { requestNewSignerSession } from "~/features/auth/signer";
import { PublishingSummaryRail } from "~/features/posts/components/ConfidencePanel";
import { useComposerState, useLocalDraft } from "~/features/posts/composer";
import {
  buildArticlePublishSummaryLines,
  buildPublishPathSummary,
  buildPublishingOutcomeSentence,
  formatPublishSummaryOptionsLine,
  getPrimaryCtaLabelForMode,
  getPrimaryCtaPendingLabelForMode,
  getQueueNextSlotLabel,
  getReadinessPresentation,
  resolveComposerIssueDisplayPhase,
  type ComposerPublishMode,
} from "~/features/posts/composer/components/composer";
import { useLongFormSubmission } from "~/features/posts/hooks/useLongFormSubmission";
import type { LongformQuoteEntry } from "~/features/posts/hooks/useLongFormSubmission";
import { useCoverImageUpload } from "~/features/posts/useCoverImageUpload";
import { useLongFormEditor } from "~/features/posts/useLongFormEditor";
import { useLongFormScheduling } from "~/features/posts/useLongFormScheduling";
import {
  formatAttemptElapsed,
  useSignAttemptProgress,
} from "~/lib/hooks/useSignAttemptProgress";
import {
  SMALL_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { stripMarkdownToPlainText } from "~/lib/markdown-utils";
import { cn } from "~/lib/utils";
import { longformPostClientSchema } from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

import { AlsoScheduleLongformQuote } from "./AlsoScheduleLongformQuote";
import { LongFormContentEditor } from "./LongFormContentEditor";
import { LongFormCoverImage } from "./LongFormCoverImage";
import { LongFormPublishingOptions } from "./LongFormPublishingOptions";

interface QueueType {
  id?: string;
  name: string;
  color?: string | null;
  hashtags?: string | null;
  scheduleType?: string;
  isEnabled?: boolean;
}

interface HashTagPreset {
  id: string;
  name: string;
  tags: string;
  description?: string | null;
}

interface InitialData {
  id?: string;
  title?: string;
  summary?: string;
  content?: string;
  image?: string;
  tags?: string[];
  queueType?: { name: string };
}

interface LongFormPostProps {
  queueTypes?: Array<string | QueueType>;
  scheduleIntervals?: number[];
  userTags?: string;
  uploadProvider?: string | null;
  userTimezone?: string;
  onQueueTypeChange?: (name: string) => void;
  onPreview?: (data: {
    title: string;
    summary: string;
    content: string;
    image: string;
  }) => void;
  initialData?: InitialData | null;
  isEditing?: boolean;
  hashTagPresets?: HashTagPreset[];
  useHashtagPresets?: boolean;
  selectedHashtagPresetId?: string | null;
  selectedHashtags?: string;
  onUseHashtagPresetsChange?: (value: boolean) => void;
  onHashtagPresetChange?: (presetId: string | null, hashtags: string) => void;
  /** When "template", only "Save as template" and Cancel are shown. */
  mode?: "default" | "template";
  /** When set with mode="template", submit uses updateTemplateLongform instead of createTemplate. */
  editTemplateContext?: { templateId: string; longFormPostId: string } | null;
  /** When editing a template, pass the current template name to prefill the composer field. */
  initialTemplateName?: string | null;
  /** Prefill schedule (datetime-local format YYYY-MM-DDTHH:mm) when opening from calendar slot. */
  initialScheduledFor?: string | null;
  /** When true, skip restoring local browser draft and clear any cached snapshot. */
  skipLocalDraftRestore?: boolean;
  publishMode?: ComposerPublishMode;
  onPublishModeChange?: (next: ComposerPublishMode) => void;
  onDraftStateLabelChange?: (label: string) => void;
  /** Default relays from loader (count + relay modal seed). */
  defaultRelays?: string[];
  /** When user saved a custom set from the relay modal. */
  relayOverride?: string[];
  /** Opens relay selector (parent owns `RelaySelectorModal`). */
  onRelayClick?: () => void;
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
}: LongFormPostProps) {
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
  const [alsoScheduleQuote, setAlsoScheduleQuote] = useState(false);
  const [publishAttempted, setPublishAttempted] = useState(false);
  const [composerTouched, setComposerTouched] = useState(false);
  const [bodyView, setBodyView] = useState<"edit" | "preview">("edit");
  const isTemplateMode = mode === "template";
  const [quoteEntries, setQuoteEntries] = useState<LongformQuoteEntry[]>(() => [
    {
      id: crypto.randomUUID(),
      value: 2,
      unit: "hours",
      caption: "",
    },
  ]);

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
    },
  });

  // Watch form values
  const title = form.watch("title");
  const summary = form.watch("summary");
  const content = form.watch("content");
  const customTags = form.watch("customTags");

  const titleFieldReg = form.register("title");
  const titleRegisterRefRef = useRef(titleFieldReg.ref);
  useEffect(() => {
    titleRegisterRefRef.current = titleFieldReg.ref;
  }, [titleFieldReg.ref]);
  const stableTitleRef = useCallback((el: HTMLInputElement | null) => {
    titleRegisterRefRef.current(el);
  }, []);

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
      alsoScheduleQuote,
      quoteEntries,
      userTimezone,
      publishMode,
      calculateQueueScheduleTime,
      relayOverride,
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

  useEffect(() => {
    if (!onDraftStateLabelChange) return;

    const busy = fetcher.state !== "idle";

    if (busy) {
      longformFetcherWasBusyRef.current = true;
      onDraftStateLabelChange(
        pendingLongformSaveDraftRef.current ? "Saving draft…" : "Saving…"
      );
      return;
    }

    const completedNetworkRequest = longformFetcherWasBusyRef.current;
    longformFetcherWasBusyRef.current = false;

    if (completedNetworkRequest && pendingLongformSaveDraftRef.current) {
      pendingLongformSaveDraftRef.current = false;
      const data = fetcher.data as
        | {
            error?: unknown;
            draftSaved?: boolean;
            longFormPostId?: string;
          }
        | undefined;
      const jsonError =
        data &&
        typeof data === "object" &&
        "error" in data &&
        data.error != null &&
        data.error !== "";
      const serverSaved =
        data &&
        typeof data === "object" &&
        data.draftSaved === true &&
        typeof data.longFormPostId === "string" &&
        data.longFormPostId.length > 0;
      if (!jsonError && serverSaved) {
        const savedId = (data as { longFormPostId: string }).longFormPostId;
        queueMicrotask(() => {
          setServerLongFormPostId(savedId);
          setLongformDraftSavedBaseline(longformDraftFingerprint);
          onDraftStateLabelChange("Draft saved");
        });
        return;
      }
    }

    if (
      longformDraftSavedBaseline !== null &&
      longformDraftFingerprint === longformDraftSavedBaseline
    ) {
      onDraftStateLabelChange("Draft saved");
      return;
    }

    if (!initialData && !skipLocalDraftRestore) {
      onDraftStateLabelChange("Saved locally");
      return;
    }

    onDraftStateLabelChange("");
  }, [
    fetcher.state,
    fetcher.data,
    longformDraftFingerprint,
    longformDraftSavedBaseline,
    initialData,
    skipLocalDraftRestore,
    onDraftStateLabelChange,
  ]);

  const deferrableBlockers: string[] = [];
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
  const issueList = deferrableBlockers;
  const issueDisplayPhase = resolveComposerIssueDisplayPhase(
    publishAttempted,
    composerTouched
  );
  const displayRedIssues =
    issueDisplayPhase === "blocking" ? [...deferrableBlockers] : [];
  const displayAmberIssues =
    issueDisplayPhase === "soft" ? [...deferrableBlockers] : [];
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
    hasSummary: Boolean((summary ?? "").trim()),
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

  const selectedQueueTypeObj = queueTypes.find(
    (q) => (typeof q === "string" ? q : q.name) === selectedQueueType
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

  const longformFollowUpSummary = alsoScheduleQuote
    ? quoteEntries.length > 0
      ? `Quote (${quoteEntries.length})`
      : "Quote"
    : "None";

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
      (customTags ?? "").trim().length > 0 ||
      (summary ?? "").trim().length > 0
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

  const editPreviewToggle = (
    <div
      className="border-border bg-background/80 inline-flex rounded-md border p-0.5"
      role="group"
      aria-label="Body view"
    >
      <button
        type="button"
        className={cn(
          "rounded px-2.5 py-1 text-xs font-medium transition-colors",
          bodyView === "edit"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => setBodyView("edit")}
        aria-pressed={bodyView === "edit"}
      >
        Edit
      </button>
      <button
        type="button"
        className={cn(
          "rounded px-2.5 py-1 text-xs font-medium transition-colors",
          bodyView === "preview"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => setBodyView("preview")}
        aria-pressed={bodyView === "preview"}
      >
        Preview
      </button>
    </div>
  );

  return (
    <>
      <div className="flex min-h-screen flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[min(100%,52rem)] space-y-5 px-4 pt-1 pb-5">
            <div className="space-y-3">
              <input
                key={initialData?.id ?? "new"}
                type="text"
                id="article-composer-title"
                placeholder="Write a title"
                className="text-foreground placeholder:text-muted-foreground w-full border-0 bg-transparent text-3xl leading-tight font-semibold tracking-tight outline-none focus:ring-0 sm:text-[2rem] dark:text-white"
                aria-label="Article title"
                name={titleFieldReg.name}
                onChange={(e) => void titleFieldReg.onChange(e)}
                onBlur={(e) => void titleFieldReg.onBlur(e)}
                ref={stableTitleRef}
              />

              <div>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                  <Label htmlFor="article-composer-summary" className="text-sm">
                    Summary
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-8 text-xs"
                    onClick={handleGenerateSummary}
                    disabled={!content}
                  >
                    Auto-generate
                  </Button>
                </div>
                <Textarea
                  id="article-composer-summary"
                  name="summary"
                  value={summary ?? ""}
                  onChange={(e) =>
                    form.setValue("summary", e.target.value, {
                      shouldValidate: true,
                    })
                  }
                  placeholder="Optional — a short line for previews and search."
                  rows={3}
                  className="resize-y text-[15px] leading-relaxed"
                />
              </div>

              <LongFormCoverImage
                image={image}
                uploadError={uploadError}
                uploadProvider={uploadProvider}
                uploadFetcherState={uploadFetcherState}
                onImageUpload={(e) => void handleImageUpload(e)}
                onRemove={() => setCoverImage("")}
                onOpenAssetBrowser={() => {}}
                softLabel
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground text-sm font-medium">
                Body
              </Label>
              <LongFormContentEditor
                key={initialData?.id ?? "new"}
                surface="editorial"
                uploadProvider={uploadProvider}
                onOpenAssetBrowser={() => {}}
                editorReady={editorReady}
                editor={editor}
                bodyView={bodyView}
                previewMarkdown={content}
                chromeLeading={editPreviewToggle}
              />
            </div>

            <div className="border-border/60 space-y-4 border-t pt-4">
              <div>
                <Label
                  htmlFor="article-composer-custom-tags"
                  className="text-sm"
                >
                  Custom tags
                </Label>
                <Input
                  id="article-composer-custom-tags"
                  {...form.register("customTags")}
                  placeholder="e.g. bitcoin, nostr, technology"
                  className="mt-1.5"
                />
              </div>

              {!isTemplateMode && displayedHashtags ? (
                <div className="flex items-center gap-2">
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
                showQueuePreset={true}
                queueType={(() => {
                  const qt = queueTypes.find(
                    (q) =>
                      (typeof q === "string" ? q : q.name) === selectedQueueType
                  );
                  if (qt && typeof qt === "object" && qt.id) {
                    return qt as {
                      id: string;
                      name: string;
                      hashTagPreset?: HashTagPreset | null;
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
            </div>
          </div>

          <div className="border-border/60 bg-background/95 border-t py-4 backdrop-blur">
            <div className="mx-auto w-full max-w-[min(100%,52rem)] space-y-4 px-4">
              {isTemplateMode ? (
                <>
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
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleSaveAsTemplate}
                      disabled={
                        fetcher.state !== "idle" ||
                        !templateName.trim() ||
                        !image
                      }
                    >
                      {fetcher.state !== "idle"
                        ? "Saving..."
                        : editTemplateContext
                          ? "Save"
                          : "Save as template"}
                    </Button>
                    <Button type="button" variant="ghost" asChild>
                      <Link to="/dashboard/templates">Cancel</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {isSigning ? (
                    <div className="dark:bg-card/30 dark:text-foreground text-muted-foreground flex items-center justify-between gap-2 rounded-md border bg-white/50 p-3 text-sm">
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
                        request. To use a new session in the signer app, click
                        &quot;Use new session&quot;.
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            void requestNewSignerSession(cancelSigning)
                          }
                        >
                          Use new session
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={cancelSigning}
                        >
                          Cancel
                        </Button>
                      </span>
                    </div>
                  ) : null}
                  {signingError ? (
                    <div className="border-destructive bg-destructive/10 text-destructive dark:border-destructive/60 dark:bg-destructive/10 dark:text-destructive rounded-md border p-3 text-sm">
                      {signingError}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
        <PublishingSummaryRail
          publishMode={publishMode}
          onPublishModeChange={onPublishModeChange ?? (() => void 0)}
          outcomeSentence={outcomeSentence}
          readiness={readinessForRail}
          sessionStrip={{
            composerStatus,
            relayCount,
            signerLabel: "NIP-07",
            onRelayClick: onRelayClick ? handleRelayRailClick : undefined,
          }}
          modeSpecificSection={
            publishMode === "now"
              ? undefined
              : {
                  lines:
                    publishMode === "queue"
                      ? [
                          ...(longformQueueNextSlotLabel
                            ? [
                                `Next slot (estimate): ${longformQueueNextSlotLabel}`,
                              ]
                            : []),
                        ]
                      : [],
                  controls: (
                    <LongFormPublishingOptions
                      layout="rail"
                      queueTypes={queueTypes}
                      selectedQueueType={selectedQueueType}
                      onQueueTypeChange={(name) => {
                        void updateDisplayedHashtags(name);
                      }}
                      scheduledFor={scheduledFor}
                      onScheduledForChange={setScheduledFor}
                      scheduleIntervals={scheduleIntervals}
                      onScheduleIntervalClick={(intervalHours) => {
                        handleScheduleIntervalClick(intervalHours);
                      }}
                      onNextSlotClick={() => {
                        void calculateQueueScheduleTime(selectedQueueType);
                      }}
                      hashTagPresets={hashTagPresets}
                      useHashtagPresets={useHashtagPresets}
                      selectedHashtagPresetId={selectedHashtagPresetId}
                      selectedHashtags={selectedHashtags}
                      onHashtagPresetChange={
                        onHashtagPresetChange ??
                        ((_id, _tags) => {
                          void _id;
                          void _tags;
                        })
                      }
                      onUseHashtagPresetsChange={
                        onUseHashtagPresetsChange ??
                        (() => {
                          void 0;
                        })
                      }
                      userTimezone={userTimezone}
                      showHashtagPresets={false}
                      hideScheduleControls={publishMode === "queue"}
                    />
                  ),
                }
          }
          followUp={{
            summaryLine: longformFollowUpSummary,
            children: (
              <AlsoScheduleLongformQuote
                alsoScheduleQuote={alsoScheduleQuote}
                onAlsoScheduleQuoteChange={setAlsoScheduleQuote}
                quoteEntries={quoteEntries}
                onQuoteEntriesChange={setQuoteEntries}
                disabled={fetcher.state !== "idle" || isSigning}
              />
            ),
          }}
          publishSummaryOptionsLine={formatPublishSummaryOptionsLine({
            followUpSummaryLine: longformFollowUpSummary,
            showRecyclable: false,
          })}
          contentSummaryLines={contentSummaryLines}
          contentSummaryDisplay="stacked"
          publishPath={publishPath}
          issues={displayRedIssues}
          warnings={displayAmberIssues}
          pristineHint={pristineHint}
          idleStatusLabel={idleStatusLabel}
          primaryActionLabel={getPrimaryCtaLabelForMode(publishMode, "article")}
          primaryActionLoading={primaryActionLoading}
          primaryActionLoadingLabel={getPrimaryCtaPendingLabelForMode(
            publishMode,
            "article"
          )}
          onPrimaryAction={() => {
            flushSync();
            void handleSchedule(publishMode === "now" ? "publish" : "schedule");
          }}
          onPrimaryActionBlocked={() => setPublishAttempted(true)}
          primaryActionDisabled={
            fetcher.state !== "idle" ||
            !isFormValid ||
            isSigning ||
            issueList.length > 0
          }
          secondaryActionLabel={secondaryIsSaveDraft ? "Save draft" : "Preview"}
          onSecondaryAction={
            secondaryIsSaveDraft
              ? () => {
                  handleSaveDraft();
                }
              : onPreview
                ? () =>
                    onPreview({
                      title,
                      summary: summary ?? generateSummaryFromContent(content),
                      content,
                      image,
                    })
                : undefined
          }
          secondaryActionDisabled={fetcher.state !== "idle" || isSigning}
        />
      </div>
    </>
  );
}
