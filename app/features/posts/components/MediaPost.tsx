import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { getDynamicQueueStyle } from "~/features/posts/queueColors";
import { resizeImage } from "~/features/upload/image-resize";
import { uploadMultipleFiles } from "~/features/upload/upload.client";
import { useOptionalUser } from "~/lib/remix-utils";

interface QueueType {
  id: string;
  name: string;
  scheduleType: "INTERVAL" | "FIXED_SLOTS";
  scheduleConfig: any;
  color?: string;
  description?: string;
  isEnabled: boolean;
}

interface MediaPostProps {
  files: any;
  setFiles: any;
  setShowImagePreview: any;
  setPreparedImageEvent: any;
  queueTypes?: (string | QueueType)[];
  hashTagPresets?: any[];
  onQueueTypeChange?: (queueType: string) => void;
  selectedHashTagPresetId?: string | null;
  onHashtagPresetChange?: (presetId: string | null, hashtags: string) => void;
}

// Helper function to determine media type
const getMediaType = (file: File) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "unknown";
};

// Helper function to check if file is acceptable
const isAcceptableFile = (file: File) => {
  const acceptedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const acceptedVideoTypes = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/mov",
    "video/avi",
  ];

  return (
    acceptedImageTypes.includes(file.type) ||
    acceptedVideoTypes.includes(file.type)
  );
};

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

  const scheduleIntervals = user?.scheduleInterval;
  const [scheduledFor, setScheduledFor] = useState("");
  const [timeError, setTimeError] = useState("");
  const [isRecyclable, setIsRecyclable] = useState(false);
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState(
    selectedHashTagPresetId || null,
  );
  const [selectedHashtags, setSelectedHashtags] = useState("");

  // Determine initial queue selection - default to "unassigned"
  const getInitialQueue = () => {
    return "unassigned";
  };

  const [selectedQueue, setSelectedQueue] = useState(getInitialQueue());

  const handleFileChange = async (e: any) => {
    const selectedFiles = Array.from(e.target.files) as File[];

    // Filter out unacceptable files
    const validFiles = selectedFiles.filter((file) => {
      if (!isAcceptableFile(file)) {
        toast.error(`File type not supported: ${file.name}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Check file sizes
    const maxImageSize = 10 * 1024 * 1024; // 10MB for images
    const maxVideoSize = 100 * 1024 * 1024; // 100MB for videos

    const oversizedFiles = validFiles.filter((file) => {
      const isImage = file.type.startsWith("image/");
      const maxSize = isImage ? maxImageSize : maxVideoSize;
      return file.size > maxSize;
    });

    if (oversizedFiles.length > 0) {
      oversizedFiles.forEach((file) => {
        const isImage = file.type.startsWith("image/");
        const maxSizeMB = isImage ? 10 : 100;
        toast.error(`${file.name} exceeds ${maxSizeMB}MB limit`);
      });
      return;
    }

    // Process files
    try {
      const processedFiles = await Promise.all(
        validFiles.map(async (file) => {
          if (file.type.startsWith("image/")) {
            // Process images to remove metadata
            return await resizeImage(file);
          }
          // Videos are uploaded as-is (no processing needed for privacy)
          return file;
        }),
      );
      setFiles((prev: any) => [...prev, ...processedFiles]);
    } catch (error) {
      console.error("Error processing media files:", error);
      toast.error("Error processing files. Using original files.");
      setFiles((prev: any) => [...prev, ...validFiles]);
    }
  };

  const handleDrop = async (e: any) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    if (droppedFiles.length > 0) {
      // Filter acceptable files
      const validFiles = droppedFiles.filter((file) => isAcceptableFile(file));

      if (validFiles.length === 0) {
        toast.error("Please drop only supported image or video files");
        return;
      }

      // Process files to remove metadata for images
      try {
        const processedFiles = await Promise.all(
          validFiles.map(async (file) => {
            if (file.type.startsWith("image/")) {
              return await resizeImage(file);
            }
            return file; // Videos are not processed
          }),
        );
        setFiles((prev: any) => [...prev, ...processedFiles]);
      } catch (error) {
        console.error("Error processing dropped media files:", error);
        toast.error("Error processing files. Using original files.");
        setFiles((prev: any) => [...prev, ...validFiles]);
      }
    }
  };

  const handleDragOver = (e: any) => {
    e.preventDefault();
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProvider, setUploadProvider] = useState<string | null>(null);

  // Fetch upload provider on component mount
  useEffect(() => {
    fetch("/api/user-upload-provider")
      .then((res) => res.json())
      .then((data) => setUploadProvider(data.provider))
      .catch((err) => console.error("Failed to get upload provider:", err));
  }, []);

  const handleImagePreview = async (e) => {
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
    const form = e.target;
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

      const preparedData = fileUrls.map((url) => {
        return {
          content: url,
          type: "media",
          queueType: url.queueType || selectedQueue,
        };
      });

      setShowImagePreview(true);
      setPreparedImageEvent(preparedData);
      setFiles([]);
      setIsUploading(false);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Upload failed: ${error.message || "Unknown error"}`);
      setIsUploading(false);
    }
  };

  const calculateQueueScheduleTime = async (queueTypeName: string) => {
    if (queueTypeName === "unassigned") {
      setScheduledFor("");
      return;
    }

    // Find the queue type object to get its ID
    const selectedQueueType = queueTypes.find(qt => 
      (typeof qt === "string" ? qt : qt.name) === queueTypeName
    );
    const queueTypeId = typeof selectedQueueType === "object" ? selectedQueueType.id : null;

    try {
      const response = await fetch("/api/queue-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queueTypeId,
          queueTypeName, // Keep for backward compatibility
          userId: user?.id,
        }),
      });

      if (response.ok) {
        const { scheduledTime } = await response.json();
        setScheduledFor(scheduledTime);
        setTimeError("");
      }
    } catch (error) {
      console.error("Error calculating schedule time:", error);
    }
  };

  useEffect(() => {
    if (selectedQueue !== "unassigned") {
      calculateQueueScheduleTime(selectedQueue);
    }
    // Notify parent component of queue type change
    if (onQueueTypeChange) {
      onQueueTypeChange(selectedQueue);
    }
  }, [selectedQueue, onQueueTypeChange]);

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

  const handleScheduleIntervalClick = (intervalHours: any) => {
    // Find the currently selected queue type
    const selectedQueueType = queueTypes.find(qt => 
      (typeof qt === "string" ? qt : qt.name) === selectedQueue
    );
    
    // If this is a fixed slot queue, use the API to get the next scheduled time instead
    if (selectedQueueType && typeof selectedQueueType === "object" && selectedQueueType.scheduleType === "FIXED_SLOTS") {
      // For fixed slot queues, recalculate the schedule time instead of adding hours
      calculateQueueScheduleTime(selectedQueue);
      return;
    }

    const now = new Date();
    const hoursLater = new Date(
      now.getTime() + parseInt(intervalHours) * 60 * 60 * 1000,
    );

    // Format the date in the user's timezone
    const userTimezone = user?.timezone || "UTC";
    const formattedDate = hoursLater.toLocaleString("en-US", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Parse the formatted date back into components
    const [datePart, timePart] = formattedDate.split(", ");
    const [month, day, year] = datePart.split("/");
    const [hours, minutes] = timePart.split(":");

    // Create the datetime-local format (YYYY-MM-DDTHH:mm)
    const formattedForInput = `${year}-${month}-${day}T${hours}:${minutes}`;

    setScheduledFor(formattedForInput);
    setTimeError("");
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
          <div className="mb-2">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Queue Type
            </label>
            <div className="flex flex-wrap gap-2">
              {/* Unassigned option */}
              <button
                type="button"
                onClick={() => setSelectedQueue("unassigned")}
                disabled={isUploading || isUploaded}
                className={`rounded-full px-4 py-2 text-sm ${getDynamicQueueStyle(null, selectedQueue === "unassigned")} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Unassigned
              </button>

              {/* Queue types */}
              {queueTypes
                .filter((queue) => {
                  const queueName = typeof queue === "string" ? queue : queue.name;
                  const isEnabled =
                    typeof queue === "object"
                      ? queue.isEnabled !== false
                      : true;
                  // Exclude "Unassigned" queue type since we have a hard-coded unassigned option
                  return isEnabled && queueName !== "Unassigned";
                })
                .map((queue) => {
                  const queueName =
                    typeof queue === "string" ? queue : queue.name;
                  const queueColor =
                    typeof queue === "object" ? queue.color : null;
                  return (
                    <button
                      key={queueName}
                      type="button"
                      onClick={() => setSelectedQueue(queueName)}
                      disabled={isUploading || isUploaded}
                      className={`rounded-full px-4 py-2 text-sm ${getDynamicQueueStyle(queueColor, selectedQueue === queueName)} disabled:cursor-not-allowed disabled:opacity-50`}
                      style={{
                        backgroundColor: queueColor || undefined,
                        borderColor: queueColor || undefined,
                      }}
                    >
                      {queueName}
                    </button>
                  );
                })}
            </div>
            <input type="hidden" name="queueType" value={selectedQueue} />
            <input 
              type="hidden" 
              name="queueTypeId" 
              value={(() => {
                const selectedQueueType = queueTypes.find(qt => 
                  (typeof qt === "string" ? qt : qt.name) === selectedQueue
                );
                return typeof selectedQueueType === "object" ? selectedQueueType.id : "";
              })()} 
            />
          </div>

          {/* Hashtag Preset Toggle */}
          <HashtagPresetToggle
            presets={hashTagPresets}
            selectedPresetId={selectedHashtagPresetId}
            onSelect={handleHashtagPresetSelect}
            disabled={isUploading || isUploaded}
            useHashtagPresets={useHashtagPresets}
            onUseHashtagPresetsChange={setUseHashtagPresets}
            showQueuePreset={selectedQueue !== "unassigned"}
            queueType={queueTypes.find(
              (q) => (typeof q === "string" ? q : q.name) === selectedQueue,
            )}
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
          <div className="flex items-center gap-4">
            <input
              type="datetime-local"
              name="scheduledFor"
              value={scheduledFor}
              onChange={(e) => {
                setScheduledFor(e.target.value);
                setTimeError("");
              }}
              className={`rounded-md border ${timeError ? "border-red-500" : "border-gray-300"} p-2 text-gray-900`}
              disabled={isUploading || isUploaded}
            />
          </div>
          {timeError ? (
            <p className="text-sm text-red-500">{timeError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {(() => {
              // Find the currently selected queue type
              const selectedQueueType = queueTypes.find(qt => 
                (typeof qt === "string" ? qt : qt.name) === selectedQueue
              );
              
              // For fixed slot queues, show a different UI
              if (selectedQueueType && typeof selectedQueueType === "object" && selectedQueueType.scheduleType === "FIXED_SLOTS") {
                return (
                  <button
                    type="button"
                    onClick={() => calculateQueueScheduleTime(selectedQueue)}
                    className="rounded-md bg-blue-100 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-300 dark:hover:bg-blue-700"
                    disabled={isUploading || isUploaded}
                  >
                    Next Slot
                  </button>
                );
              }
              
              // For interval-based queues, show the hour buttons
              return scheduleIntervals
                ? scheduleIntervals.map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      onClick={() => handleScheduleIntervalClick(interval)}
                      className="rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      disabled={isUploading || isUploaded}
                    >
                      +{interval}h
                    </button>
                  ))
                : null;
            })()
            }
          </div>
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
