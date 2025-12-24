import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import AssetBrowser from "~/features/assets/components/AssetBrowser";
import { getDynamicQueueStyle } from "~/features/posts/queueColors";
import { signEventFn } from "~/lib/nostr";
import { useOptionalUser } from "~/lib/remix-utils";

export default function TextPost({
  queueTypes = [],
  assets = [],
  hashTagPresets = [],
  onQueueTypeChange,
  selectedHashTagPresetId,
  onHashtagPresetChange,
}) {
  const fetcher = useFetcher();
  const user = useOptionalUser();
  const tags = user?.hashTags?.tags;
  const scheduleIntervals = user?.scheduleInterval;
  const [scheduledFor, setScheduledFor] = useState("");
  const [contentError, setContentError] = useState("");
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [content, setContent] = useState("");
  const [isRecyclable, setIsRecyclable] = useState(false);
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState(
    selectedHashTagPresetId || null,
  );
  const [selectedHashtags, setSelectedHashtags] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Determine initial queue selection - default to "unassigned"
  const getInitialQueue = () => {
    return "unassigned";
  };

  const [selectedQueue, setSelectedQueue] = useState(getInitialQueue());

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const contentValue = formData.get("content");
    const scheduledFor = formData.get("scheduledFor");
    const submitType = e.nativeEvent.submitter.value;

    // Ensure queueType is set from current state
    formData.set("queueType", selectedQueue);
    // Set isRecyclable checkbox state
    if (isRecyclable) {
      formData.set("isRecyclable", "on");
    }
    // Add hashtag preset selection
    if (useHashtagPresets && selectedHashtagPresetId) {
      formData.set("hashTagPresetId", selectedHashtagPresetId);
      formData.set("useHashtagPresets", "on");
    }

    // Check if content is empty (except for draft saves)
    if (
      submitType !== "draft-text" &&
      (!contentValue || contentValue.trim() === "")
    ) {
      setContentError("Post content cannot be empty");
      toast.error("Post content cannot be empty");
      return;
    }

    setContentError("");

    try {
      // For draft saves, we don't need to sign the event
      if (submitType === "draft-text") {
        formData.set("_action", submitType);
        fetcher.submit(formData, { method: "post" });
        return;
      }

      const userTimezone = user?.timezone || "UTC";
      let scheduledTime;

      if (submitType === "post-text") {
        scheduledTime = Date.now();
      } else {
        const scheduledForStr = scheduledFor;

        // Only convert timezone if not UTC/Etc/GMT
        if (userTimezone !== "UTC" && userTimezone !== "Etc/GMT") {
          const utcDate = new Date(scheduledForStr);

          // Get timezone offset in minutes between user timezone and UTC
          const userDate = new Date(scheduledForStr).toLocaleString("en-US", {
            timeZone: userTimezone,
          });
          const userOffset =
            (new Date(userDate) - new Date(scheduledForStr)) / 60000;

          // Adjust the date by the offset
          utcDate.setMinutes(utcDate.getMinutes() - userOffset);
          scheduledTime = utcDate.getTime();
        } else {
          // Parse date string and ensure it's in UTC
          const dateObj = new Date(scheduledForStr + "Z");
          scheduledTime = dateObj.getTime();
        }
      }

      const scheduledForUnix = Math.floor(scheduledTime / 1000);

      // Get effective hashtags - prioritize manual selection over queue defaults
      let effectiveHashtags = "";

      if (useHashtagPresets) {
        // Manual hashtag presets are enabled
        if (selectedHashtags) {
          // Use manually selected hashtag preset
          effectiveHashtags = selectedHashtags;
        }
        // If useHashtagPresets is true but no manual preset selected, use no hashtags
        // This ensures manual hashtag preset selection overrides queue defaults
      } else {
        // Manual hashtag presets are disabled, use queue type's default hashtags
        // Find the queue type object to get its ID
        const selectedQueueType = queueTypes.find(qt => 
          (typeof qt === "string" ? qt : qt.name) === selectedQueue
        );
        const queueTypeId = typeof selectedQueueType === "object" ? selectedQueueType.id : null;
        
        try {
          const response = await fetch("/api/effective-hashtags", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: user?.id,
              queueTypeId,
              queueTypeName: selectedQueue, // Keep for backward compatibility
            }),
          });

          if (response.ok) {
            const data = await response.json();
            effectiveHashtags = data.hashtags || "";
          } else {
            // Fallback to user's default hashtags
            effectiveHashtags = Array.isArray(tags)
              ? tags.join(" ")
              : tags || "";
          }
        } catch (error) {
          const { handleErrorSafely } = await import("~/lib/error-handler.client");
          handleErrorSafely(error, {
            component: "TextPost",
            action: "fetchEffectiveHashtags",
          });
          // Fallback to user's default hashtags
          effectiveHashtags = Array.isArray(tags) ? tags.join(" ") : tags || "";
        }
      }

      const tagArray = effectiveHashtags
        .split(" ")
        .filter((tag) => tag.length > 0)
        .map((tag) => ["t", tag.replace("#", "")]);

      const contentToSign = user?.showHashTagsinPosts
        ? `${contentValue}\n${effectiveHashtags}`
        : contentValue;

      const { nostrEvent, signedEvent } = await signEventFn({
        content: contentToSign,
        created_at: scheduledForUnix,
        kind: 1,
        tags: tagArray,
      });

      formData.append("nostrEvent", JSON.stringify(nostrEvent));
      formData.append("signedEvent", JSON.stringify(signedEvent));
      formData.append("scheduledFor", scheduledForUnix.toString());
      formData.set("_action", submitType);

      fetcher.submit(formData, { method: "post" });
    } catch (error) {
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(error, {
        component: "TextPost",
        action: "handleSubmit",
      }, false); // Don't show toast, let component handle it
    }
  };

  const calculateQueueScheduleTime = async (queueTypeName) => {
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

  const handleScheduleIntervalClick = (intervalHours) => {
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

  const handleAssetsSelected = (selectedAssets: any[]) => {
    // Separate text assets and image assets
    const textAssets = [];
    const imageAssets = [];

    selectedAssets.forEach((asset) => {
      if (asset.assetType === "TEXT") {
        const textContent = asset.content || asset.title || "";
        if (textContent) {
          textAssets.push(textContent);
        }
      } else if (asset.assetType === "IMAGE") {
        const imageUrl = asset.fileUrl || "";
        if (imageUrl) {
          imageAssets.push(imageUrl);
        }
      }
    });

    // Combine text assets first, then image URLs
    const allAssets = [...textAssets, ...imageAssets];
    const newContent = allAssets.join("\n");

    // Always append assets below existing content
    const updatedContent = content ? content + "\n" + newContent : newContent;
    setContent(updatedContent);

    // Update the textarea value
    if (textareaRef.current) {
      textareaRef.current.value = updatedContent;
    }
  };

  return (
    <fetcher.Form method="post" className="w-full" onSubmit={handleSubmit}>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          name="content"
          className={contentError ? "border-red-500" : ""}
          placeholder="Start writing your post here..."
          rows={6}
          disabled={fetcher.state !== "idle"}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setContentError("");
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAssetBrowser(true)}
          disabled={fetcher.state !== "idle"}
          className="absolute right-2 top-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-1 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          Assets
        </Button>
      </div>
      {contentError ? (
        <div className="mt-1 text-sm text-red-500">{contentError}</div>
      ) : null}
      <div className="mt-2 text-right text-sm text-gray-500">0/2200</div>
      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="queueType">Queue Type</Label>
            <div className="flex flex-wrap gap-2">
              {/* Unassigned option */}
              <button
                type="button"
                onClick={() => setSelectedQueue("unassigned")}
                disabled={fetcher.state !== "idle"}
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
                      disabled={fetcher.state !== "idle"}
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
            disabled={fetcher.state !== "idle"}
            useHashtagPresets={useHashtagPresets}
            onUseHashtagPresetsChange={setUseHashtagPresets}
            showQueuePreset={selectedQueue !== "unassigned"}
            queueType={queueTypes.find(
              (q) => (typeof q === "string" ? q : q.name) === selectedQueue,
            )}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRecyclable"
              name="isRecyclable"
              checked={isRecyclable}
              onChange={(e) => setIsRecyclable(e.target.checked)}
              disabled={fetcher.state !== "idle"}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <Label
              htmlFor="isRecyclable"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              Make this post recyclable
            </Label>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="scheduledFor">Schedule for later</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                type="datetime-local"
                id="scheduledFor"
                name="scheduledFor"
                value={scheduledFor || ""}
                onChange={(e) => {
                  setScheduledFor(e.target.value);
                }}
                disabled={fetcher.state !== "idle"}
              />
              <Button
                type="submit"
                value="schedule-text"
                name="_action"
                disabled={fetcher.state !== "idle"}
                className="text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mr-1.5 h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
                {fetcher.state !== "idle"
                  ? "Scheduling..."
                  : "Sign and Schedule"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(() => {
                // Find the currently selected queue type
                const selectedQueueType = queueTypes.find(qt => 
                  (typeof qt === "string" ? qt : qt.name) === selectedQueue
                );
                
                // For fixed slot queues, show a different UI
                if (selectedQueueType && typeof selectedQueueType === "object" && selectedQueueType.scheduleType === "FIXED_SLOTS") {
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => calculateQueueScheduleTime(selectedQueue)}
                      className="border-blue-500 text-blue-700 hover:bg-blue-50"
                    >
                      Next Slot
                    </Button>
                  );
                }
                
                // For interval-based queues, show the hour buttons
                return scheduleIntervals
                  ? scheduleIntervals.map((interval) => (
                      <Button
                        key={interval}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleScheduleIntervalClick(interval)}
                      >
                        +{interval}h
                      </Button>
                    ))
                  : null;
              })()
              }
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            value="draft-text"
            name="_action"
            variant="outline"
            disabled={fetcher.state !== "idle"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-1.5 h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
              <path
                fillRule="evenodd"
                d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
                clipRule="evenodd"
              />
            </svg>
            {fetcher.state !== "idle" ? "Saving..." : "Save as Draft"}
          </Button>
          <Button
            type="submit"
            value="post-text"
            name="_action"
            className="bg-green-600 text-white hover:bg-green-700"
            disabled={fetcher.state !== "idle"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-1.5 h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
                clipRule="evenodd"
              />
            </svg>
            {fetcher.state !== "idle" ? "Posting..." : "Post Now"}
          </Button>
        </div>
      </div>

      {showAssetBrowser ? (
        <AssetBrowser
          assets={assets}
          onAssetsSelected={handleAssetsSelected}
          onClose={() => setShowAssetBrowser(false)}
        />
      ) : null}
    </fetcher.Form>
  );
}
