import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";

import { getDynamicQueueStyle } from "~/features/posts/queueColors";
import type { QueueType } from "~/features/posts/types";
import { resizeImage } from "~/features/upload/image-resize";
import { useOptionalUser } from "~/lib/remix-utils";

interface PreparedEventData {
  content: string;
  type: "image";
  queueType: string;
}

interface ImagePostProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setShowImagePreview: (show: boolean) => void;
  setPreparedImageEvent: (data: PreparedEventData[]) => void;
  queueTypes?: (string | QueueType)[];
  onQueueTypeChange?: (queueType: string) => void;
}

export default function ImagePost({
  files,
  setFiles,
  setShowImagePreview,
  setPreparedImageEvent,
  queueTypes = [],
  onQueueTypeChange,
}: ImagePostProps) {
  const fetcher = useFetcher();
  const user = useOptionalUser();

  const scheduleIntervals = user?.scheduleInterval;
  const [scheduledFor, setScheduledFor] = useState("");
  const [timeError, setTimeError] = useState("");
  const [isRecyclable, setIsRecyclable] = useState(false);

  // Determine initial queue selection - default to "unassigned"
  const getInitialQueue = () => {
    return "unassigned";
  };

  const [selectedQueue, setSelectedQueue] = useState(getInitialQueue());

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files) as File[];

    // Process files to remove metadata for privacy
    try {
      const processedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          if (file.type.startsWith("image/")) {
            return await resizeImage(file);
          }
          return file;
        }),
      );
      setFiles((prev: File[]) => [...prev, ...processedFiles]);
    } catch (error) {
      const { handleAsyncErrorWithMessage } = await import("~/lib/error-handler.client");
      handleAsyncErrorWithMessage(
        error,
        "Error processing images. Using original files.",
        {
          component: "ImagePost",
          action: "handleFileChange",
        },
        false, // Don't show toast, we call toast.error instead
      );
      toast.error("Error processing images. Using original files.");
      setFiles((prev: File[]) => [...prev, ...selectedFiles]);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    if (droppedFiles.length > 0) {
      // Check if files are images
      const imageFiles = droppedFiles.filter((file) =>
        file.type.startsWith("image/"),
      );
      if (imageFiles.length === 0) {
        toast.error("Please drop only image files");
        return;
      }

      // Process files to remove metadata for privacy
      try {
        const processedFiles = await Promise.all(
          imageFiles.map(async (file) => await resizeImage(file)),
        );
        setFiles((prev: File[]) => [...prev, ...processedFiles]);
      } catch (error) {
        const { handleAsyncErrorWithMessage } = await import("~/lib/error-handler.client");
        handleAsyncErrorWithMessage(
          error,
          "Error processing images. Using original files.",
          {
            component: "ImagePost",
            action: "handleDrop",
          },
          false, // Don't show toast, we call toast.error instead
        );
        toast.error("Error processing images. Using original files.");
        setFiles((prev: File[]) => [...prev, ...imageFiles]);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleImagePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Check if scheduledFor is empty
    if (!scheduledFor) {
      setTimeError("Please set a scheduled time before uploading");
      toast.error("Please set a scheduled time before uploading");
      return;
    }

    setTimeError("");
    const form = e.target;
    const formData = new FormData(form);
    formData.set("_action", "upload-images-preview");
    formData.set("queueType", selectedQueue);
    // Set isRecyclable checkbox state
    if (isRecyclable) {
      formData.set("isRecyclable", "on");
    }

    // Remove any existing files from formData
    formData.delete("files");

    // Append each file individually to formData
    files.forEach((file) => {
      formData.append("files", file);
    });

    fetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
    });
  };

  const calculateQueueScheduleTime = useCallback(async (queueTypeName: string) => {
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
  }, [queueTypes, user?.id]);

  useEffect(() => {
    if (selectedQueue !== "unassigned") {
      calculateQueueScheduleTime(selectedQueue);
    }
    // Notify parent component of queue type change
    if (onQueueTypeChange) {
      onQueueTypeChange(selectedQueue);
    }
  }, [selectedQueue, onQueueTypeChange, calculateQueueScheduleTime]);

  const handleScheduleIntervalClick = (intervalHours: string | number) => {
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

  // Handle fetcher success data
  if (fetcher.data?.success && fetcher.data?.fileUrls) {
    toast.success("Images uploaded successfully!");

    const preparedData = fetcher.data.fileUrls.map((url) => {
      return {
        content: url,
        type: "image",
        queueType: url.queueType || selectedQueue, // Include queue type information
      };
    });

    setShowImagePreview(true);
    setPreparedImageEvent(preparedData);
    setFiles([]);
  }

  // Add error handling
  if (fetcher.data?.success === false && fetcher.data?.error) {
    toast.error(fetcher.data.error);
  }

  const isUploaded = fetcher.data?.success && fetcher.data?.fileUrls;

  return (
    <fetcher.Form
      method="post"
      className="w-full"
      encType="multipart/form-data"
      onSubmit={handleImagePreview}
    >
      <input type="hidden" name="_action" value="upload-images-preview" />
      <label
        className={`block ${isUploaded ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="file"
          name="files"
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          disabled={fetcher.state !== "idle" || isUploaded}
        />
        <div
          className={`rounded-lg border-2 border-dashed border-gray-300 p-12 text-center ${!isUploaded && "hover:border-gray-400"}`}
          onDrop={!isUploaded ? handleDrop : undefined}
          onDragOver={!isUploaded ? handleDragOver : undefined}
        >
          {files.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {files.map((file, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Preview"
                    className="h-32 w-32 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFiles(files.filter((_, i) => i !== index))
                    }
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                    disabled={fetcher.state !== "idle"}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex h-32 w-32 items-center justify-center border-2 border-dashed border-gray-300 hover:border-gray-400">
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
                  Multiple images (max 100MB total)
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
          placeholder="Add a caption to your image(s)..."
          rows={3}
          disabled={fetcher.state !== "idle" || isUploaded}
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="mb-2">
            <label htmlFor="queue-type-selector" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Queue Type
            </label>
            <div className="flex flex-wrap gap-2">
              {/* Unassigned option */}
              <button
                type="button"
                onClick={() => setSelectedQueue("unassigned")}
                disabled={fetcher.state !== "idle" || isUploaded}
                className={`rounded-full px-4 py-2 text-sm ${getDynamicQueueStyle(null, selectedQueue === "unassigned")} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Unassigned
              </button>

              {/* Queue types */}
              {queueTypes
                .filter((queue) => {
                  const isEnabled =
                    typeof queue === "object"
                      ? queue.isEnabled !== false
                      : true;
                  return isEnabled;
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
                      disabled={fetcher.state !== "idle" || isUploaded}
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
          </div>
          <div className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="isRecyclable"
              name="isRecyclable"
              checked={isRecyclable}
              onChange={(e) => setIsRecyclable(e.target.checked)}
              disabled={fetcher.state !== "idle" || isUploaded}
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
              disabled={fetcher.state !== "idle" || isUploaded}
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
                    disabled={fetcher.state !== "idle" || isUploaded}
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
                      disabled={fetcher.state !== "idle" || isUploaded}
                    >
                      +{interval}h
                    </button>
                  ))
                : null;
            })()
            }
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-green-500 px-8 py-4 text-white hover:bg-green-600 disabled:opacity-50"
          disabled={
            fetcher.state !== "idle" || isUploaded || files.length === 0
          }
        >
          {fetcher.state !== "idle" ? "Uploading..." : "Upload Images →"}
        </button>
      </div>
    </fetcher.Form>
  );
}
