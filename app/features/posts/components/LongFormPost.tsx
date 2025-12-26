import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import AssetBrowser from "~/features/assets/components/AssetBrowser";
import type { Asset } from "~/features/assets/types";
import {
  signLongFormEvent,
  convertEditorJSToMarkdown,
  generateArticleIdentifier,
} from "~/lib/nostr";

import { useCoverImageUpload } from "../useCoverImageUpload";
import { useLongFormEditor } from "../useLongFormEditor";
import { useLongFormScheduling } from "../useLongFormScheduling";

import { LongFormActionButtons } from "./LongFormActionButtons";
import { LongFormCoverImage } from "./LongFormCoverImage";
import { LongFormEditorStyles } from "./LongFormEditorStyles";
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
  queueTypes?: (string | QueueType)[];
  scheduleIntervals?: number[];
  userTags?: string;
  assets?: Asset[];
  uploadProvider?: string | null;
  userTimezone?: string;
  onQueueTypeChange?: (name: string) => void;
  onPreview?: (data: { title: string; summary: string; content: string; image: string }) => void;
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
  isEditing = false,
  hashTagPresets = [],
  useHashtagPresets = false,
  selectedHashtagPresetId = null,
  selectedHashtags = "",
  onUseHashtagPresetsChange,
  onHashtagPresetChange,
}: LongFormPostProps) {
  const fetcher = useFetcher();
  const [title, setTitle] = useState(initialData?.title || "");
  const [summary, setSummary] = useState(initialData?.summary || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [customTags, setCustomTags] = useState(
    initialData?.tags?.join(", ") || "",
  );
  const [showAssetBrowser, setShowAssetBrowser] = useState("");

  // Use extracted hooks
  const {
    editorReady,
    loadInitialData,
    insertAssetIntoEditor,
    generateSummaryFromContent,
  } = useLongFormEditor({
    uploadProvider,
    onContentChange: setContent,
  });

  const {
    image,
    setImage,
    uploadError,
    uploadFetcherState,
    handleImageUpload,
    handleCoverImageAssets,
    handleFetcherData,
    handleFetcherStateChange,
  } = useCoverImageUpload({
    uploadProvider,
    initialImage: initialData?.image || "",
  });

  const {
    selectedQueueType,
    scheduledFor,
    setScheduledFor,
    displayedHashtags,
    updateDisplayedHashtags,
    handleScheduleIntervalClick,
    calculateQueueScheduleTime,
  } = useLongFormScheduling({
    queueTypes,
    scheduleIntervals,
    userTags,
    userTimezone,
    initialQueueType: initialData?.queueType?.name || "Unassigned",
    onQueueTypeChange,
  });

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
        loadInitialData(initialData.content!);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [editorReady, initialData?.content, loadInitialData]);

  const handleAssetBrowserSelect = (selectedAssets: Asset[]) => {
    if (showAssetBrowser === "cover") {
      handleCoverImageAssets(selectedAssets.map(asset => ({
        assetType: asset.assetType,
        fileUrl: asset.fileUrl || undefined,
      })));
    } else {
      insertAssetIntoEditor(selectedAssets.map(asset => ({
        assetType: asset.assetType,
        fileUrl: asset.fileUrl || undefined,
        content: asset.content || undefined,
        title: asset.title || undefined,
      })));
    }
    setShowAssetBrowser("");
  };

  const handleGenerateSummary = () => {
    const generatedSummary = generateSummaryFromContent(content);
    if (generatedSummary) {
      setSummary(generatedSummary);
    }
  };

  const handleSchedule = async (actionType: "schedule" | "publish") => {
    if (!title.trim() || !content.trim()) {
      return;
    }

    try {
      let markdownContent;
      try {
        const editorData = JSON.parse(content);
        markdownContent = convertEditorJSToMarkdown(editorData);
      } catch {
        markdownContent = content;
      }

      const finalSummary = summary || generateSummaryFromContent(content);
      const identifier = generateArticleIdentifier(title);

      let scheduledTimestamp;
      if (actionType === "schedule" && scheduledFor) {
        const scheduledTime = new Date(scheduledFor);
        scheduledTimestamp = Math.floor(scheduledTime.getTime() / 1000);
      }

      // Get effective hashtags - prioritize manual selection over queue defaults
      let effectiveHashtags = "";

      if (useHashtagPresets) {
        // Manual hashtag presets are enabled
        if (selectedHashtags) {
          // Use manually selected hashtag preset
          effectiveHashtags = selectedHashtags;
        }
        // If useHashtagPresets is true but no manual preset selected, use no hashtags
      } else {
        // Manual hashtag presets are disabled, use displayed hashtags (queue defaults)
        effectiveHashtags = displayedHashtags || "";
      }

      const hashtagsFromQueue = effectiveHashtags
        ? effectiveHashtags
          .split(" ")
          .map((tag) => tag.replace("#", "").trim())
          .filter(Boolean)
        : [];
      const customTagsList = customTags
        ? customTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
        : [];
      // Combine and deduplicate tags (case insensitive)
      const allTags = [...hashtagsFromQueue, ...customTagsList];
      const uniqueTags = allTags.filter(
        (tag, index) =>
          allTags.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) ===
          index,
      );

      const eventData = {
        title,
        content: markdownContent,
        summary: finalSummary,
        image,
        tags: uniqueTags,
        identifier,
        publishedAt:
          actionType === "publish"
            ? Math.floor(Date.now() / 1000)
            : scheduledTimestamp,
      };

      const { nostrEvent, signedEvent } = await signLongFormEvent(eventData);

      const form = document.createElement("form");
      form.method = "POST";
      form.style.display = "none";

      const fields: [string, string][] = [
        [
          "_action",
          actionType === "schedule" ? "schedule-longform" : "publish",
        ],
        ["title", title],
        ["content", content],
        ["summary", finalSummary],
        ["image", image],
        ["tags", uniqueTags.join(",")],
        ["queueType", selectedQueueType],
        [
          "scheduledFor",
          scheduledTimestamp ? scheduledTimestamp.toString() : "",
        ],
        ["signedEvent", JSON.stringify(signedEvent)],
        ["nostrEvent", JSON.stringify(nostrEvent)],
      ];

      fields.forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value || "";
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(error, {
        component: "LongFormPost",
        action: "handleSubmit",
      }, false); // Don't show toast, let component handle it
    }
  };

  const isFormValid = !!(title.trim() && summary.trim() && content.trim() && image);

  return (
    <>
      <LongFormEditorStyles />

      <div className="space-y-6">
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            name="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter your post title"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="summary">Summary *</Label>
          <div className="mt-1 flex gap-2">
            <Textarea
              id="summary"
              name="summary"
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of your post"
              rows={3}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateSummary}
              disabled={!content}
              className="whitespace-nowrap"
            >
              Auto-generate
            </Button>
          </div>
        </div>

        <LongFormCoverImage
          image={image}
          uploadError={uploadError}
          uploadProvider={uploadProvider}
          uploadFetcherState={uploadFetcherState}
          onImageUpload={handleImageUpload}
          onRemove={() => setImage("")}
          onOpenAssetBrowser={() => setShowAssetBrowser("cover")}
        />

        <div>
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Label htmlFor="content">Content *</Label>
              {uploadProvider ? (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span>Images upload via:</span>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${uploadProvider.includes("BLOSSOM")
                      ? "bg-purple-100 text-purple-800"
                      : "bg-blue-100 text-blue-800"
                      }`}
                  >
                    {uploadProvider.includes("BLOSSOM")
                      ? `🌸 ${uploadProvider === "BLOSSOM_PRIMAL" ? "Primal" : "Blosstr"}`
                      : "☁️ S3"}
                  </span>
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAssetBrowser("content")}
              className="text-xs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mr-1 h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Insert Assets
            </Button>
          </div>
          <div className="mt-1 rounded-lg border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600">
            <div className="min-h-[500px] p-4">
              <div
                id="editorjs"
                className="prose prose-lg dark:prose-invert min-h-[460px] max-w-none"
              ></div>
            </div>
          </div>
          <input type="hidden" name="content" value={content} />
        </div>

        {/* Custom Tags Input */}
        <div>
          <Label htmlFor="customTags">Custom Tags</Label>
          <Input
            id="customTags"
            name="customTags"
            type="text"
            value={customTags}
            onChange={(e) => setCustomTags(e.target.value)}
            placeholder="Enter custom tags separated by commas (e.g. bitcoin, nostr, technology)"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            These tags will be added to the NOSTR event and combined with queue
            type hashtags if any
          </p>
        </div>

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
          onQueueTypeChange={updateDisplayedHashtags}
          scheduledFor={scheduledFor}
          onScheduledForChange={setScheduledFor}
          scheduleIntervals={scheduleIntervals}
          onScheduleIntervalClick={handleScheduleIntervalClick}
          onNextSlotClick={() => calculateQueueScheduleTime(selectedQueueType)}
          hashTagPresets={hashTagPresets}
          useHashtagPresets={useHashtagPresets}
          selectedHashtagPresetId={selectedHashtagPresetId}
          selectedHashtags={selectedHashtags}
          onHashtagPresetChange={onHashtagPresetChange || ((_id, _tags) => { void _id; void _tags; })}
          onUseHashtagPresetsChange={onUseHashtagPresetsChange || (() => { void 0; })}
        />

        <LongFormActionButtons
          fetcherState={fetcher.state}
          isFormValid={isFormValid}
          hasScheduledFor={!!scheduledFor}
          onPreview={() => {
            if (onPreview) {
              onPreview({
                title,
                summary: summary || generateSummaryFromContent(content),
                content,
                image,
              });
            }
          }}
          onSchedule={() => handleSchedule("schedule")}
          onPublish={() => handleSchedule("publish")}
        />

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
