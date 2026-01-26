import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

import { Badge } from "~/components/ui/badge";
import { AssetBrowser, type Asset } from "~/features/assets";
import { longformPostClientSchema } from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

import { useLongFormSubmission } from "../hooks/useLongFormSubmission";
import { useCoverImageUpload } from "../useCoverImageUpload";
import { useLongFormEditor } from "../useLongFormEditor";
import { useLongFormScheduling } from "../useLongFormScheduling";

import { LongFormActionButtons } from "./LongFormActionButtons";
import { LongFormContentEditor } from "./LongFormContentEditor";
import { LongFormCoverImage } from "./LongFormCoverImage";
import { LongFormEditorStyles } from "./LongFormEditorStyles";
import { LongFormPostFields } from "./LongFormPostFields";
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
  const [showAssetBrowser, setShowAssetBrowser] = useState("");

  // Initialize form with React Hook Form
  const form = useZodForm(longformPostClientSchema, {
    defaultValues: {
      title: initialData?.title ?? "",
      summary: initialData?.summary ?? "",
      content: initialData?.content ?? "",
      customTags: initialData?.tags?.join(", ") ?? "",
      scheduledFor: "",
      queueType: initialData?.queueType?.name ?? "Unassigned",
      useHashtagPresets: useHashtagPresets,
      hashTagPresetId: selectedHashtagPresetId ?? undefined,
    },
  });

  // Watch form values
  const title = form.watch("title");
  const summary = form.watch("summary");
  const content = form.watch("content");
  const customTags = form.watch("customTags");

  // Use extracted hooks
  const {
    editorReady,
    loadInitialData,
    insertAssetIntoEditor,
    generateSummaryFromContent,
  } = useLongFormEditor({
    uploadProvider,
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
    initialQueueType: initialData?.queueType?.name ?? "Unassigned",
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

  useEffect(() => {
    if (formQueueType && formQueueType !== schedulingQueueType) {
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

  // Handle initial data loading - wait for both editor ready and initial data
  useEffect(() => {
    if (editorReady && initialData?.content) {
      const timeoutId = setTimeout(() => {
        void loadInitialData(initialData.content!);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [editorReady, initialData?.content, loadInitialData]);

  const handleAssetBrowserSelect = (selectedAssets: Asset[]) => {
    if (showAssetBrowser === "cover") {
      handleCoverImageAssets(
        selectedAssets.map((asset) => ({
          assetType: asset.assetType,
          fileUrl: asset.fileUrl ?? undefined,
        }))
      );
    } else {
      void insertAssetIntoEditor(
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

  const { handleSchedule, isSigning, signingError } = useLongFormSubmission({
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
    title: title ?? "",
    summary: summary ?? "",
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
    content: content ?? "",
    image,
    customTags: customTags ?? "",
    selectedQueueType,
    scheduledFor,
    displayedHashtags,
    useHashtagPresets,
    selectedHashtags,
  });

  // Form validation using Zod
  const isFormValid = form.formState.isValid && !!image;

  return (
    <>
      <LongFormEditorStyles />

      <div className="space-y-6">
        <LongFormPostFields
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
          title={title ?? ""}
          summary={summary ?? ""}
          customTags={customTags ?? ""}
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
          content={content ?? ""}
          onTitleChange={(value) => form.setValue("title", value)}
          onSummaryChange={(value) => form.setValue("summary", value)}
          onCustomTagsChange={(value) => form.setValue("customTags", value)}
          onGenerateSummary={handleGenerateSummary}
        />

        <LongFormCoverImage
          image={image}
          uploadError={uploadError}
          uploadProvider={uploadProvider}
          uploadFetcherState={uploadFetcherState}
          onImageUpload={(file) => void handleImageUpload(file)}
          onRemove={() => {
            setCoverImage("");
          }}
          onOpenAssetBrowser={() => setShowAssetBrowser("cover")}
        />

        <LongFormContentEditor
          uploadProvider={uploadProvider}
          onOpenAssetBrowser={() => setShowAssetBrowser("content")}
        />

        {/* Hashtags Display */}
        {displayedHashtags ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <svg
                className="hi-solid hi-hashtag mr-1 inline-block size-3 opacity-75"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.53 6H17a1 1 0 110 2h-2.97l-1 4H15a1 1 0 110 2h-2.47l-.56 2.242a1 1 0 11-1.94-.485L10.47 14H7.53l-.56 2.242a1 1 0 11-1.94-.485L5.47 14H3a1 1 0 110-2h2.97l1-4H5a1 1 0 110-2h2.47l.56-2.243a1 1 0 011.213-.727zM9.03 8l-1 4h2.938l1-4H9.031z"
                  clipRule="evenodd"
                />
              </svg>
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

        <LongFormActionButtons
          fetcherState={fetcher.state}
          isFormValid={isFormValid}
          hasScheduledFor={!!scheduledFor}
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
          onSchedule={() => void handleSchedule("schedule")}
          onPublish={() => void handleSchedule("publish")}
        />

        {isSigning ? (
          <div className="dark:bg-card/30 dark:text-foreground text-muted-foreground mt-3 rounded-md border bg-white/50 p-3 text-sm">
            Waiting for signer approval… If you’re using a remote signer, open
            it to approve the request.
          </div>
        ) : null}
        {signingError ? (
          <div className="border-destructive bg-destructive/10 text-destructive dark:border-destructive/60 dark:bg-destructive/10 dark:text-destructive mt-3 rounded-md border p-3 text-sm">
            {signingError}
          </div>
        ) : null}

        {/* Asset Browser Modal */}
        {showAssetBrowser ? (
          <AssetBrowser
            assets={assets}
            onAssetsSelected={handleAssetBrowserSelect}
            onClose={() => setShowAssetBrowser("")}
          />
        ) : null}
      </div>
    </>
  );
}
