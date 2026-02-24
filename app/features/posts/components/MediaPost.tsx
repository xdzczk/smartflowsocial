import { Upload } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Checkbox } from "~/components/ui/checkbox";
import { uploadMultipleFiles } from "~/features/upload/upload.client";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { useOptionalUser } from "~/lib/remix-utils";
import { getMinScheduleTimestampMs, parseDateTimeLocal } from "~/lib/temporal";

import { usePostScheduling } from "../hooks/usePostScheduling";
import type { QueueType, HashTagPreset } from "../types";
import { validateAndProcessFiles } from "../utils/file-processing.client";

import { QueueSelector } from "./QueueSelector";
import { SchedulingSection } from "./SchedulingSection";

interface PreparedEventData {
  content: {
    fileUrl: string;
    scheduledFor: string;
    caption: string;
    queueType: string;
  };
  type: "media";
  queueType: string;
}

interface MediaPostProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setShowImagePreview: (show: boolean) => void;
  setPreparedImageEvent: (data: PreparedEventData[]) => void;
  queueTypes?: Array<string | QueueType>;
  hashTagPresets?: HashTagPreset[];
  selectedQueueType?: string;
  onQueueTypeChange?: (queueType: string) => void;
  selectedHashTagPresetId?: string | null;
  onHashtagPresetChange?: (presetId: string | null, hashtags: string) => void;
}

// Helper function to determine media type (kept for backward compatibility)
const getMediaType = (file: File) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "unknown";
};

// isAcceptableFile is now imported from file-processing.client.ts

export default function MediaPost({
  files,
  setFiles,
  setShowImagePreview,
  setPreparedImageEvent,
  queueTypes = [],
  hashTagPresets = [],
  onQueueTypeChange,
  selectedHashTagPresetId,
  onHashtagPresetChange,
}: MediaPostProps) {
  const user = useOptionalUser();

  const [isRecyclable, setIsRecyclable] = useState(false);
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState(
    selectedHashTagPresetId ?? null
  );
  const [_selectedHashtags, setSelectedHashtags] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);

  // Use the shared scheduling hook
  const {
    selectedQueue,
    setSelectedQueue,
    scheduledFor,
    setScheduledFor,
    calculateQueueScheduleTime,
    handleScheduleIntervalClick,
    scheduleIntervals,
  } = usePostScheduling({
    queueTypes,
    scheduleIntervals: user?.scheduleInterval as number[] | undefined,
    userTimezone: user?.timezone ?? undefined,
    initialQueue: "unassigned",
    onQueueTypeChange,
    onTimeError: setTimeError,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];

    // Use extracted utility for validation and processing
    const processedFiles = await validateAndProcessFiles(selectedFiles);

    if (processedFiles) {
      setFiles((prev: File[]) => [...prev, ...processedFiles]);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);

    if (droppedFiles.length > 0) {
      // Use extracted utility for validation and processing
      const processedFiles = await validateAndProcessFiles(droppedFiles);

      if (processedFiles) {
        setFiles((prev: File[]) => [...prev, ...processedFiles]);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProvider, setUploadProvider] = useState<string | null>(null);

  // Fetch upload provider on component mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/user-upload-provider");
        const data: unknown = await res.json();
        const provider =
          data &&
          typeof data === "object" &&
          !Array.isArray(data) &&
          "provider" in data &&
          typeof data.provider === "string"
            ? data.provider
            : null;
        setUploadProvider(provider);
      } catch (err) {
        const { handleErrorSafely } =
          require("~/lib/error-handler.client") as unknown as {
            handleErrorSafely: (
              error: unknown,
              context: { component: string; action: string }
            ) => void;
          };
        handleErrorSafely(err, {
          component: "MediaPost",
          action: "fetchUploadProvider",
        });
      }
    })();
  }, []);

  const handleImagePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Check if scheduledFor is empty
    if (!scheduledFor) {
      setTimeError("Please set a scheduled time before uploading");
      toast.error("Please set a scheduled time before uploading");
      return;
    }

    const userTz = user?.timezone ?? "UTC";
    try {
      const zoned = parseDateTimeLocal(scheduledFor, userTz);
      const utcZoned = zoned.withTimeZone("UTC");
      const scheduledMs = utcZoned.epochMilliseconds;
      const minMs = getMinScheduleTimestampMs(userTz);
      if (scheduledMs < minMs) {
        setTimeError("Please select a date and time in the future.");
        toast.error("Please select a date and time in the future.");
        return;
      }
    } catch {
      setTimeError("Invalid date or time.");
      toast.error("Invalid date or time.");
      return;
    }

    if (files.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    setTimeError("");
    setIsUploading(true);

    // Get form data
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const caption = formData.get("caption") ?? "";

    try {
      // Use the new upload utility that handles both S3 and Blossom
      const uploadResults = await uploadMultipleFiles(files);

      // Check if all uploads were successful
      const failedUploads = uploadResults.filter((result) => !result.success);
      if (failedUploads.length > 0) {
        const errorMessages = failedUploads
          .map((result) => result.error)
          .join(", ");
        toast.error(`Upload failed: ${errorMessages}`);
        setIsUploading(false);
        return;
      }

      // Extract URLs from successful uploads
      const fileUrls = uploadResults
        .filter((result) => result.success && result.file)
        .map((result) => ({
          fileUrl: result.file!.url,
          scheduledFor,
          caption: caption,
          queueType: selectedQueue,
        }));

      if (fileUrls.length === 0) {
        toast.error("No files were successfully uploaded");
        setIsUploading(false);
        return;
      }

      toast.success("Media uploaded successfully!");

      const preparedData: PreparedEventData[] = fileUrls.map((url) => {
        return {
          content: {
            fileUrl: url.fileUrl,
            scheduledFor: url.scheduledFor,
            caption:
              typeof url.caption === "string"
                ? url.caption
                : String(url.caption),
            queueType: url.queueType,
          },
          type: "media",
          queueType: url.queueType,
        };
      });

      setShowImagePreview(true);
      setPreparedImageEvent(preparedData);
      setFiles([]);
      setIsUploading(false);
    } catch (error) {
      const { handleAsyncError, getErrorMessage } =
        await import("~/lib/error-handler.client");
      const errorMessage = getErrorMessage(error);
      handleAsyncError(
        error,
        {
          component: "MediaPost",
          action: "handleImagePreview",
        },
        false
      ); // Don't show toast, we call toast.error instead
      toast.error(`Upload failed: ${errorMessage}`);
      setIsUploading(false);
    }
  };

  const handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string
  ) => {
    setSelectedHashtagPresetId(presetId);
    setSelectedHashtags(hashtags);
    if (onHashtagPresetChange) {
      onHashtagPresetChange(presetId, hashtags);
    }
  };

  const isUploaded = false; // Removed old fetcher logic

  return (
    <form className="w-full" onSubmit={(e) => void handleImagePreview(e)}>
      <input type="hidden" name="_action" value="upload-media-preview" />
      <label className="block cursor-pointer">
        <input
          id="media-post-file-input"
          type="file"
          name="files"
          className="hidden"
          accept="image/*,video/*"
          multiple
          onChange={(e) => void handleFileChange(e)}
          disabled={isUploading}
        />
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop zone for media files. Click or drag and drop files here."
          className="border-border hover:border-border rounded-lg border-2 border-dashed p-12 text-center"
          onDrop={(e) => void handleDrop(e)}
          onDragOver={handleDragOver}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              document
                .querySelector<HTMLInputElement>('input[type="file"]')
                ?.click();
            }
          }}
        >
          {files.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {files.map((file, index) => {
                const mediaType = getMediaType(file);
                const objectURL = URL.createObjectURL(file);

                return (
                  // eslint-disable-next-line react/no-array-index-key -- Stable list of media files, no unique ID available
                  <div key={index} className="relative">
                    {mediaType === "image" ? (
                      <img
                        src={objectURL}
                        alt="Preview"
                        className="h-32 w-32 rounded object-cover"
                      />
                    ) : mediaType === "video" ? (
                      <video
                        src={objectURL}
                        className="h-32 w-32 rounded object-cover"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <div className="bg-muted flex h-32 w-32 items-center justify-center rounded">
                        <span className="text-muted-foreground text-xs">
                          Unsupported
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setFiles(files.filter((_, i) => i !== index))
                      }
                      className="bg-destructive hover:bg-destructive absolute -top-2 -right-2 rounded-full p-1 text-white"
                      disabled={isUploading}
                    >
                      ×
                    </button>
                    {/* Media type indicator */}
                    <div className="bg-opacity-70 absolute bottom-1 left-1 rounded bg-black px-2 py-1 text-xs text-white">
                      {mediaType === "video" ? "🎥" : "🖼️"}
                    </div>
                  </div>
                );
              })}
              <div className="border-border hover:border-border flex h-32 w-32 items-center justify-center rounded border-2 border-dashed">
                <span className="text-muted-foreground text-4xl">+</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="text-success">
                <Upload
                  className="h-12 w-12"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </div>
              <div>
                <p className="text-foreground dark:text-foreground text-xl font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Images (10MB max) and Videos (100MB max)
                </p>
              </div>
            </div>
          )}
        </div>
      </label>
      <div className="mt-4">
        <textarea
          name="caption"
          className="text-foreground w-full rounded-lg border p-4"
          placeholder="Add a caption to your media..."
          rows={3}
          disabled={isUploading || isUploaded}
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <QueueSelector
            queueTypes={queueTypes}
            selectedQueue={selectedQueue}
            onQueueChange={setSelectedQueue}
            disabled={isUploading || isUploaded}
            className="mb-2"
          />

          {/* Hashtag Preset Toggle */}
          <HashtagPresetToggle
            presets={hashTagPresets}
            selectedPresetId={selectedHashtagPresetId}
            onSelect={handleHashtagPresetSelect}
            disabled={isUploading || isUploaded}
            useHashtagPresets={useHashtagPresets}
            onUseHashtagPresetsChange={setUseHashtagPresets}
            showQueuePreset={selectedQueue !== "unassigned"}
            queueType={
              (queueTypes.find(
                (q) => (typeof q === "string" ? q : q.name) === selectedQueue
              ) ?? null) as QueueType | null | undefined
            }
          />
          <div className="mb-2 flex items-center gap-2">
            <Checkbox
              id="isRecyclable"
              checked={isRecyclable}
              onCheckedChange={(c) => setIsRecyclable(c === true)}
              disabled={isUploading || isUploaded}
            />
            <input
              type="hidden"
              name="isRecyclable"
              value={isRecyclable ? "on" : ""}
            />
            <label
              htmlFor="isRecyclable"
              className="text-muted-foreground dark:text-foreground text-sm"
            >
              Make this post recyclable
            </label>
          </div>
          <SchedulingSection
            scheduledFor={scheduledFor}
            onScheduledForChange={setScheduledFor}
            scheduleIntervals={scheduleIntervals}
            queueTypes={queueTypes}
            selectedQueue={selectedQueue}
            onScheduleIntervalClick={(intervalHours) => {
              handleScheduleIntervalClick(intervalHours);
            }}
            onCalculateNextSlot={() => {
              void calculateQueueScheduleTime(selectedQueue);
            }}
            disabled={isUploading || isUploaded}
            showTimeInput={true}
            userTimezone={user?.timezone ?? "UTC"}
          />
          {timeError ? (
            <p className="text-destructive text-sm">{timeError}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {uploadProvider ? (
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <span>Upload via:</span>
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${
                  uploadProvider.includes("BLOSSOM")
                    ? "bg-muted text-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {uploadProvider.includes("BLOSSOM")
                  ? `🌸 ${uploadProvider === "BLOSSOM_PRIMAL" ? "Primal" : uploadProvider === "BLOSSOM_SFS" ? "SmartFlow Blossom" : "Blosstr"}`
                  : "☁️ S3"}
              </span>
            </div>
          ) : null}
          <button
            type="submit"
            className="bg-success hover:bg-success rounded-lg px-8 py-4 text-white disabled:opacity-50"
            disabled={isUploading || files.length === 0}
          >
            {isUploading ? "Uploading..." : "Upload Media →"}
          </button>
        </div>
      </div>
    </form>
  );
}
