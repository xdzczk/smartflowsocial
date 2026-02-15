import { Link, useFetcher } from "@remix-run/react";
import { Hash } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  SMALL_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { stripMarkdownToPlainText } from "~/lib/markdown-utils";
import { longformPostClientSchema } from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

import { useLocalDraft } from "../hooks/useComposerLocalDraft";
import { useLongFormSubmission } from "../hooks/useLongFormSubmission";
import type { LongformQuoteEntry } from "../hooks/useLongFormSubmission";
import { useCoverImageUpload } from "../useCoverImageUpload";
import { useLongFormEditor } from "../useLongFormEditor";
import { useLongFormScheduling } from "../useLongFormScheduling";

import { AlsoScheduleLongformQuote } from "./AlsoScheduleLongformQuote";
import { ArticleDetailsCollapsible } from "./ArticleDetailsCollapsible";
import { LongFormActionButtons } from "./LongFormActionButtons";
import { LongFormPublishingOptions } from "./LongFormPublishingOptions";
import { WritingSurface } from "./WritingSurface";

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
}

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
}: LongFormPostProps) {
  const fetcher = useFetcher();
  const [templateName, setTemplateName] = useState(
    () => initialTemplateName ?? ""
  );
  const [alsoScheduleQuote, setAlsoScheduleQuote] = useState(false);
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
      scheduledFor: "",
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
  }>(longformDraftKey, !!initialData, 2000);
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
    if (!longformRestored || initialData || appliedLongformRestoredRef.current)
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
    if (initialData) return;
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
    if (initialData) return;
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
    flushLongformSnapshot,
    title,
    summary,
    content,
    image,
    customTags,
    schedulingQueueType,
  ]);

  useEffect(() => {
    if (fetcher.state === "submitting" && !initialData) {
      clearLongformSnapshot();
    }
  }, [fetcher.state, initialData, clearLongformSnapshot]);

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
    fetcher.submit(formData, { method: "post" });
  };

  const { handleSchedule, isSigning, signingError } = useLongFormSubmission({
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
  });

  // Form validation using Zod
  const isFormValid = form.formState.isValid && !!image;

  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) return;
    flushSync();
    const values = form.getValues();
    const formData = new FormData();
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

  return (
    <>
      <div className="flex min-h-screen flex-col">
        {/* Phase 1: Writing Surface (hero); key by draft id so editor remounts with new content */}
        <WritingSurface
          key={initialData?.id ?? "new"}
          register={form.register}
          content={content}
          uploadProvider={uploadProvider}
          onOpenAssetBrowser={() => {}}
          editorReady={editorReady}
          editor={editor}
        />

        {/* Phase 2: Article Details (collapsible) */}
        <ArticleDetailsCollapsible
          summary={summary ?? ""}
          customTags={customTags ?? ""}
          content={content}
          onSummaryChange={(value) => form.setValue("summary", value)}
          onCustomTagsChange={(value) => form.setValue("customTags", value)}
          onGenerateSummary={handleGenerateSummary}
          image={image}
          uploadError={uploadError}
          uploadProvider={uploadProvider}
          uploadFetcherState={uploadFetcherState}
          onImageUpload={(file) => void handleImageUpload(file)}
          onRemoveImage={() => setCoverImage("")}
          onOpenAssetBrowser={() => {}}
        />

        {/* Phase 3: Publish Panel */}
        <div className="border-border/60 bg-background/95 border-t py-4 backdrop-blur">
          <div className="mx-auto w-full max-w-[760px] space-y-4 px-4">
            {isTemplateMode ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="template-name-longform">Template name</Label>
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
                      fetcher.state !== "idle" || !templateName.trim() || !image
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
                {displayedHashtags ? (
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

                <LongFormPublishingOptions
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
                />

                <AlsoScheduleLongformQuote
                  alsoScheduleQuote={alsoScheduleQuote}
                  onAlsoScheduleQuoteChange={setAlsoScheduleQuote}
                  quoteEntries={quoteEntries}
                  onQuoteEntriesChange={setQuoteEntries}
                  disabled={fetcher.state !== "idle" || isSigning}
                />

                {!image ? (
                  <p className="text-muted-foreground text-xs">
                    Add a cover before publishing
                  </p>
                ) : null}

                <LongFormActionButtons
                  fetcherState={fetcher.state}
                  isFormValid={isFormValid}
                  hasScheduledFor={!!scheduledFor}
                  scheduledFor={scheduledFor}
                  statusLabel={scheduledFor ? undefined : "Draft"}
                  onSaveDraft={!initialData ? handleSaveDraft : undefined}
                  saveDraftDisabled={
                    !initialData
                      ? fetcher.state !== "idle" || !content.trim() || isSigning
                      : undefined
                  }
                  scheduledForLabel={
                    scheduledFor
                      ? (() => {
                          try {
                            const d = new Date(scheduledFor);
                            if (Number.isNaN(d.getTime())) return "Scheduled";
                            const month = d.toLocaleString("default", {
                              month: "short",
                            });
                            const day = d.getDate();
                            const time = d.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            });
                            return `Scheduled for ${month} ${day}, ${time}`;
                          } catch {
                            return "Scheduled";
                          }
                        })()
                      : undefined
                  }
                  wordCount={wordCount}
                  isSigning={isSigning}
                  onPreview={() => {
                    if (onPreview) {
                      onPreview({
                        title,
                        summary: summary ?? generateSummaryFromContent(content),
                        content,
                        image,
                      });
                    }
                  }}
                  onSchedule={() => {
                    flushSync();
                    void handleSchedule("schedule");
                  }}
                  onPublish={() => {
                    flushSync();
                    void handleSchedule("publish");
                  }}
                />

                {isSigning ? (
                  <div className="dark:bg-card/30 dark:text-foreground text-muted-foreground rounded-md border bg-white/50 p-3 text-sm">
                    Waiting for signer approval… If you’re using a remote
                    signer, open it to approve the request.
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
    </>
  );
}
