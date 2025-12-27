import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { QueueSelector } from "~/features/posts/components/QueueSelector";
import { SchedulingSection } from "~/features/posts/components/SchedulingSection";
import { usePostScheduling } from "~/features/posts/hooks/usePostScheduling";
import type { QueueType, HashTagPreset } from "~/features/posts/types";
import {
  validateAndProcessFiles,
  isAcceptableFile,
} from "~/features/posts/utils/file-processing.client";
import { uploadMultipleFiles } from "~/features/upload/upload.client";
import { useOptionalUser } from "~/lib/remix-utils";

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
  queueTypes?: (string | QueueType)[];
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
  const fetcher = useFetcher();
  const user = useOptionalUser();

  const [isRecyclable, setIsRecyclable] = useState(false);
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState(
    selectedHashTagPresetId || null,
  );
  const [selectedHashtags, setSelectedHashtags] = useState("");
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
        const provider = data && typeof data === "object" && !Array.isArray(data) && "provider" in data && typeof data.provider === "string" ? data.provider : undefined;
        setUploadProvider(provider);
      } catch (err) {
         
        const { handleErrorSafely } = require("~/lib/error-handler.client") as { handleErrorSafely: (error: unknown, context: { component: string; action: string }) => void };
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

    if (files.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    setTimeError("");
    setIsUploading(true);

    // Get form data
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const caption = formData.get("caption") || "";

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
            caption: typeof url.caption === "string" ? url.caption : String(url.caption || ""),
            queueType: url.queueType || selectedQueue,
          },
          type: "media",
          queueType: url.queueType || selectedQueue,
        };
      });

      setShowImagePreview(true);
      setPreparedImageEvent(preparedData);
      setFiles([]);
      setIsUploading(false);
    } catch (error) {
      const { handleAsyncError, getErrorMessage } = await import("~/lib/error-handler.client");
      const errorMessage = getErrorMessage(error) || "Unknown error";
      handleAsyncError(error, {
        component: "MediaPost",
        action: "handleImagePreview",
      }, false); // Don't show toast, we call toast.error instead
      toast.error(`Upload failed: ${errorMessage}`);
      setIsUploading(false);
    }
  };

  const handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string,
  ) => {
    setSelectedHashtagPresetId(presetId);
    setSelectedHashtags(hashtags);
    if (onHashtagPresetChange) {
      onHashtagPresetChange(presetId, hashtags);
    }
  };

  const isUploaded = false; // Removed old fetcher logic

  return (
    <form className="w-full" onSubmit={handleImagePreview}>
      <input type="hidden" name="_action" value="upload-media-preview" />
      <label
        className={`block ${isUploaded ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="file"
          name="files"
          className="hidden"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          disabled={isUploading || isUploaded}
        />
        <div
          className={`rounded-lg border-2 border-dashed border-gray-300 p-12 text-center ${!isUploaded && "hover:border-gray-400"}`}
          onDrop={!isUploaded ? handleDrop : undefined}
          onDragOver={!isUploaded ? handleDragOver : undefined}
        >
          {files.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {files.map((file, index) => {
                const mediaType = getMediaType(file);
                const objectURL = URL.createObjectURL(file);

                return (
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
                      <div className="flex h-32 w-32 items-center justify-center rounded bg-gray-200">
                        <span className="text-xs text-gray-500">
                          Unsupported
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setFiles(files.filter((_, i) => i !== index))
                      }
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                      disabled={isUploading}
                    >
                      ×
                    </button>
                    {/* Media type indicator */}
                    <div className="absolute bottom-1 left-1 rounded bg-black bg-opacity-70 px-2 py-1 text-xs text-white">
                      {mediaType === "video" ? "🎥" : "🖼️"}
                    </div>
                  </div>
                );
              })}
              <div className="flex h-32 w-32 items-center justify-center rounded border-2 border-dashed border-gray-300 hover:border-gray-400">
                <span className="text-4xl text-gray-500">+</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="text-green-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xl font-medium text-gray-900 dark:text-gray-100">
                  Click to upload or drag and drop
                </p>
                <p className="mt-1 text-sm text-gray-500">
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
          className="w-full rounded-lg border p-4 text-gray-900"
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
            queueType={(queueTypes.find(
              (q) => (typeof q === "string" ? q : q.name) === selectedQueue,
            ) || null) as QueueType | null | undefined}
          />
          <div className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="isRecyclable"
              name="isRecyclable"
              checked={isRecyclable}
              onChange={(e) => setIsRecyclable(e.target.checked)}
              disabled={isUploading || isUploaded}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="isRecyclable"
              className="text-sm text-gray-700 dark:text-gray-300"
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
            onScheduleIntervalClick={handleScheduleIntervalClick}
            onCalculateNextSlot={() => calculateQueueScheduleTime(selectedQueue)}
            disabled={isUploading || isUploaded}
            showTimeInput={true}
          />
          {timeError ? (
            <p className="text-sm text-red-500">{timeError}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {uploadProvider ? (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>Upload via:</span>
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${
                  uploadProvider.includes("BLOSSOM")
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
          <button
            type="submit"
            className="rounded-lg bg-green-500 px-8 py-4 text-white hover:bg-green-600 disabled:opacity-50"
            disabled={isUploading || isUploaded || files.length === 0}
          >
            {isUploading ? "Uploading..." : "Upload Media →"}
          </button>
        </div>
      </div>
    </form>
  );
}
