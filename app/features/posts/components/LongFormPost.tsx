import { useFetcher } from "@remix-run/react";
import { Hash } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { Badge } from "~/components/ui/badge";
import { AssetBrowser, type Asset } from "~/features/assets";
import {
  SMALL_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { stripMarkdownToPlainText } from "~/lib/markdown-utils";
import { longformPostClientSchema } from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

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
  assets?: Asset[];
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
}

export default function LongFormPost({
  queueTypes = [],
  scheduleIntervals = [],
  userTags = "",
  assets = [],
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
}: LongFormPostProps) {
  const fetcher = useFetcher();
  const autosaveFetcher = useFetcher();
  const [showAssetBrowser, setShowAssetBrowser] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [alsoScheduleQuote, setAlsoScheduleQuote] = useState(false);
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
    insertAssetIntoEditor,
    generateSummaryFromContent,
    flushSync,
  } = useLongFormEditor({
    uploadProvider,
    initialMarkdown: initialData?.content ?? "",
    onContentChange: (newContent) => form.setValue("content", newContent),
  });

  const {
    image: coverImage,
    setImage: setCoverImage,
    uploadError,
    uploadFetcherState,
    handleImageUpload,
    handleCoverImageAssets,
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

  // Sync scheduling hook with form
  useEffect(() => {
    form.setValue("queueType", schedulingQueueType);
  }, [schedulingQueueType, form]);

  useEffect(() => {
    if (schedulingScheduledFor) {
      form.setValue("scheduledFor", schedulingScheduledFor);
    }
  }, [schedulingScheduledFor, form]);

  // Sync form with scheduling hook
  const formScheduledFor = form.watch("scheduledFor");
  const formQueueType = form.watch("queueType");
  useEffect(() => {
    if (formScheduledFor !== schedulingScheduledFor) {
      setSchedulingScheduledFor(formScheduledFor ?? null);
    }
  }, [formScheduledFor, schedulingScheduledFor, setSchedulingScheduledFor]);

  // Sync form -> scheduling only when the form value actually changed (e.g. user
  // changed dropdown). Avoid running when schedulingQueueType changed from a
  // button click, which would otherwise overwrite the selection with stale form value.
  const prevFormQueueTypeRef = useRef(formQueueType);
  useEffect(() => {
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

  const handleAssetBrowserSelect = (selectedAssets: Asset[]) => {
    if (showAssetBrowser === "cover") {
      handleCoverImageAssets(
        selectedAssets.map((asset) => ({
          assetType: asset.assetType,
          fileUrl: asset.fileUrl ?? undefined,
        }))
      );
    } else {
      insertAssetIntoEditor(
        selectedAssets.map((asset) => ({
          assetType: asset.assetType,
          fileUrl: asset.fileUrl ?? undefined,
          content: asset.content ?? undefined,
          title: asset.title ?? undefined,
        }))
      );
    }
    setShowAssetBrowser("");
  };

  const handleGenerateSummary = () => {
    const generatedSummary = generateSummaryFromContent(content);
    if (generatedSummary) {
      form.setValue("summary", generatedSummary);
    }
  };

  // Autosave: debounce 2.5s after title, summary, content, or image change (new page only)
  const autosavePendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (_isEditing) return;
    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- form.watch() can be undefined before first sync; ?? "" for .trim() and FormData.set() */
    const t = (title ?? "").trim();
    const c = (content ?? "").trim();
    if (!t || !c) return;
    if (autosavePendingRef.current) clearTimeout(autosavePendingRef.current);
    autosavePendingRef.current = setTimeout(() => {
      autosavePendingRef.current = null;
      if (autosaveFetcher.state !== "idle") return;
      flushSync(); // ensure form has latest markdown before building FormData
      const fd = new FormData();
      fd.set("_action", "autosave-draft");
      // Read form values after flush so content is current
      const currentTitle = form.getValues("title");
      const currentContent = form.getValues("content");
      const currentSummary = form.getValues("summary");
      fd.set("title", currentTitle ?? "");
      fd.set("content", currentContent ?? "");
      fd.set("summary", currentSummary ?? "");
      fd.set("image", image ?? "");
      fd.set("customTags", form.getValues("customTags") ?? "");
      fd.set("queueType", selectedQueueType);
      fd.set("useHashtagPresets", useHashtagPresets ? "true" : "false");
      fd.set("hashTagPresetId", selectedHashtagPresetId ?? "");
      autosaveFetcher.submit(fd, { method: "post" });
    }, 2500);
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */
    return () => {
      if (autosavePendingRef.current) clearTimeout(autosavePendingRef.current);
    };
    // Omit autosaveFetcher: Remix useFetcher() returns a stable reference; including it would not change behavior but could trigger unnecessary effect runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional omit of stable autosaveFetcher
  }, [
    _isEditing,
    title,
    summary,
    content,
    image,
    customTags,
    selectedQueueType,
    useHashtagPresets,
    selectedHashtagPresetId,
    flushSync,
  ]);

  // React to autosave result (defer setState to avoid synchronous setState in effect)
  useEffect(() => {
    if (autosaveFetcher.state !== "idle" || !autosaveFetcher.data) return;
    const data = autosaveFetcher.data as { success?: boolean; error?: string };
    const run = () => {
      if (data.success) {
        setLastSavedAt(new Date());
        setAutosaveError(null);
      } else {
        setAutosaveError(data.error ?? "Couldn't save draft");
      }
    };
    queueMicrotask(run);
  }, [autosaveFetcher.state, autosaveFetcher.data]);

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
          onOpenAssetBrowser={() => setShowAssetBrowser("content")}
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
          onOpenAssetBrowser={() => setShowAssetBrowser("cover")}
        />

        {/* Phase 3: Publish Panel */}
        <div className="border-border/60 bg-background/95 border-t py-4 backdrop-blur">
          <div className="mx-auto w-full max-w-[760px] space-y-4 px-4">
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
              lastSavedAt={lastSavedAt}
              autosaveError={autosaveError}
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
                Waiting for signer approval… If you’re using a remote signer,
                open it to approve the request.
              </div>
            ) : null}
            {signingError ? (
              <div className="border-destructive bg-destructive/10 text-destructive dark:border-destructive/60 dark:bg-destructive/10 dark:text-destructive rounded-md border p-3 text-sm">
                {signingError}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Asset Browser Modal */}
      {showAssetBrowser ? (
        <AssetBrowser
          assets={assets}
          onAssetsSelected={handleAssetBrowserSelect}
          onClose={() => setShowAssetBrowser("")}
        />
      ) : null}
    </>
  );
}
