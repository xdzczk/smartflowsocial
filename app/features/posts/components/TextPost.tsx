import { useFetcher } from "@remix-run/react";
import React from "react";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import AssetBrowser from "~/features/assets/components/AssetBrowser";
import type { Asset } from "~/features/assets/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { textPostClientSchema } from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

import { usePostScheduling } from "../hooks/usePostScheduling";
import type { QueueType } from "../types";

import { QueueSelector } from "./QueueSelector";
import { SchedulingSection } from "./SchedulingSection";

interface TextPostProps {
  queueTypes?: Array<string | QueueType>;
  assets?: Asset[];
  hashTagPresets?: Array<{ id: string; name: string; tags: string }>;
  onQueueTypeChange?: (queueType: string) => void;
  selectedHashTagPresetId?: string | null | undefined;
  onHashtagPresetChange?: (presetId: string | null, hashtags: string) => void;
}

export default function TextPost({
  queueTypes = [],
  assets = [],
  hashTagPresets = [],
  onQueueTypeChange,
  selectedHashTagPresetId,
  onHashtagPresetChange,
}: TextPostProps) {
  const fetcher = useFetcher();
  const user = useOptionalUser();
  // Note: User doesn't have hashTags property - this would need to come from hashTagPresets relation
  const tags: string[] = [];
  const [showAssetBrowser, setShowAssetBrowser] = React.useState(false);
  const [selectedHashtags, setSelectedHashtags] = React.useState("");

  // Initialize form with React Hook Form
  const form = useZodForm(textPostClientSchema, {
    defaultValues: {
      content: "",
      scheduledFor: "",
      queueType: "unassigned",
      isRecyclable: false,
      useHashtagPresets: false,
      hashTagPresetId: selectedHashTagPresetId ?? undefined,
    },
  });

  const content = form.watch("content");
  const useHashtagPresets = form.watch("useHashtagPresets");
  const selectedHashtagPresetId = form.watch("hashTagPresetId");

  // Use the shared scheduling hook
  const {
    selectedQueue,
    setSelectedQueue,
    scheduledFor: schedulingScheduledFor,
    setScheduledFor: setSchedulingScheduledFor,
    calculateQueueScheduleTime,
    handleScheduleIntervalClick,
    scheduleIntervals,
  } = usePostScheduling({
    queueTypes,
    scheduleIntervals: user?.scheduleInterval as number[] | undefined,
    userTimezone: user?.timezone ?? undefined,
    initialQueue: "unassigned",
    onQueueTypeChange,
  });

  // Sync form's queueType with scheduling hook
  React.useEffect(() => {
    form.setValue("queueType", selectedQueue);
  }, [selectedQueue, form]);

  // Sync form's scheduledFor with scheduling hook
  React.useEffect(() => {
    if (schedulingScheduledFor) {
      form.setValue("scheduledFor", schedulingScheduledFor);
    }
  }, [schedulingScheduledFor, form]);

  // Sync scheduling hook when form's scheduledFor changes
  const formScheduledFor = form.watch("scheduledFor");
  React.useEffect(() => {
    if (formScheduledFor !== schedulingScheduledFor) {
      setSchedulingScheduledFor(formScheduledFor ?? "");
    }
  }, [formScheduledFor, schedulingScheduledFor, setSchedulingScheduledFor]);

  const handleSubmit = form.handleSubmit(async (data, event) => {
    const submitter = event?.nativeEvent
      ? ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)
      : undefined;
    const submitType = submitter?.value ?? "";

    // For draft saves, we don't need to sign the event
    if (submitType === "draft-text") {
      const formData = new FormData();
      formData.set("_action", submitType);
      formData.set("content", data.content);
      formData.set("queueType", data.queueType);
      if (data.isRecyclable) {
        formData.set("isRecyclable", "on");
      }
      if (data.useHashtagPresets && data.hashTagPresetId) {
        formData.set("hashTagPresetId", data.hashTagPresetId);
        formData.set("useHashtagPresets", "on");
      }
      fetcher.submit(formData, { method: "post" });
      return;
    }

    try {
      const userTimezone = user?.timezone ?? "UTC";
      let scheduledTime;

      if (submitType === "post-text") {
        scheduledTime = Date.now();
      } else {
        const scheduledForStr = data.scheduledFor ?? "";

        // Only convert timezone if not UTC/Etc/GMT
        if (userTimezone !== "UTC" && userTimezone !== "Etc/GMT") {
          const utcDate = new Date(scheduledForStr);

          // Get timezone offset in minutes between user timezone and UTC
          const userDateStr = new Date(scheduledForStr).toLocaleString(
            "en-US",
            {
              timeZone: userTimezone,
            }
          );
          const userDate = new Date(userDateStr);
          const scheduledDate = new Date(scheduledForStr);
          const userOffset =
            (userDate.getTime() - scheduledDate.getTime()) / 60000;

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

      if (data.useHashtagPresets) {
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
        const selectedQueueType = queueTypes.find(
          (qt) => (typeof qt === "string" ? qt : qt.name) === selectedQueue
        );
        const queueTypeId =
          typeof selectedQueueType === "object" ? selectedQueueType.id : null;

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
            const data = (await response.json()) as { hashtags?: string };
            effectiveHashtags = data.hashtags ?? "";
          } else {
            // Fallback to user's default hashtags
            effectiveHashtags = tags.join(" ");
          }
        } catch (error) {
          const { handleErrorSafely } =
            await import("~/lib/error-handler.client");
          handleErrorSafely(error, {
            component: "TextPost",
            action: "fetchEffectiveHashtags",
          });
          // Fallback to user's default hashtags
          effectiveHashtags = tags.join(" ");
        }
      }

      const tagArray = effectiveHashtags
        .split(" ")
        .filter((tag) => tag.length > 0)
        .map((tag) => ["t", tag.replace("#", "")]);

      const contentToSign = user?.showHashTagsinPosts
        ? `${data.content}\n${effectiveHashtags}`
        : data.content;

      const { nostrEvent, signedEvent } = await nostrAdapter.signEvent({
        content: contentToSign,
        created_at: scheduledForUnix,
        kind: 1,
        tags: tagArray,
      });

      const formData = new FormData();
      formData.set("_action", submitType);
      formData.set("content", data.content);
      formData.set("queueType", data.queueType);
      formData.append("nostrEvent", JSON.stringify(nostrEvent));
      formData.append("signedEvent", JSON.stringify(signedEvent));
      formData.append("scheduledFor", scheduledForUnix.toString());
      if (data.isRecyclable) {
        formData.set("isRecyclable", "on");
      }
      if (data.useHashtagPresets && data.hashTagPresetId) {
        formData.set("hashTagPresetId", data.hashTagPresetId);
        formData.set("useHashtagPresets", "on");
      }

      fetcher.submit(formData, { method: "post" });
    } catch (error) {
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "TextPost",
          action: "handleSubmit",
        },
        false
      ); // Don't show toast, let component handle it
    }
  });

  const handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string
  ) => {
    form.setValue("hashTagPresetId", presetId ?? undefined);
    setSelectedHashtags(hashtags);
    if (onHashtagPresetChange) {
      onHashtagPresetChange(presetId, hashtags);
    }
  };

  const handleAssetsSelected = (selectedAssets: Asset[]) => {
    // Separate text assets and image assets
    const textAssets: string[] = [];
    const imageAssets: string[] = [];

    selectedAssets.forEach((asset) => {
      if (asset.assetType === "TEXT") {
        const textContent = asset.content ?? asset.title ?? "";
        if (textContent) {
          textAssets.push(textContent);
        }
      } else if (asset.assetType === "IMAGE") {
        const imageUrl = asset.fileUrl ?? "";
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
    form.setValue("content", updatedContent);
  };

  return (
    <fetcher.Form
      method="post"
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit(e);
      }}
    >
      <div className="relative">
        <Textarea
          {...form.register("content")}
          className={form.formState.errors.content ? "border-red-500" : ""}
          placeholder="Start writing your post here..."
          rows={6}
          disabled={fetcher.state !== "idle"}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAssetBrowser(true)}
          disabled={fetcher.state !== "idle"}
          className="absolute top-2 right-2"
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
      {form.formState.errors.content ? (
        <div className="mt-1 text-sm text-red-500">
          {form.formState.errors.content.message}
        </div>
      ) : null}
      <div className="mt-2 text-right text-sm text-gray-500">
        {content.length}/5000
      </div>
      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-4">
          <QueueSelector
            queueTypes={queueTypes}
            selectedQueue={selectedQueue}
            onQueueChange={setSelectedQueue}
            disabled={fetcher.state !== "idle"}
            className="mb-2"
          />

          {/* Hashtag Preset Toggle */}
          <HashtagPresetToggle
            presets={hashTagPresets}
            selectedPresetId={selectedHashtagPresetId}
            onSelect={handleHashtagPresetSelect}
            disabled={fetcher.state !== "idle"}
            useHashtagPresets={useHashtagPresets}
            onUseHashtagPresetsChange={(enabled) => {
              form.setValue("useHashtagPresets", enabled);
            }}
            showQueuePreset={selectedQueue !== "unassigned"}
            queueType={
              queueTypes.find(
                (q) => (typeof q === "string" ? q : q.name) === selectedQueue
              ) as QueueType | undefined
            }
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRecyclable"
              {...form.register("isRecyclable")}
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
                {...form.register("scheduledFor")}
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
            <SchedulingSection
              scheduledFor={formScheduledFor ?? schedulingScheduledFor}
              onScheduledForChange={(value) => {
                form.setValue("scheduledFor", value);
                setSchedulingScheduledFor(value);
              }}
              scheduleIntervals={scheduleIntervals}
              queueTypes={queueTypes}
              selectedQueue={selectedQueue}
              onScheduleIntervalClick={(intervalHours) =>
                void handleScheduleIntervalClick(intervalHours)
              }
              onCalculateNextSlot={() => {
                void calculateQueueScheduleTime(selectedQueue);
              }}
              disabled={fetcher.state !== "idle"}
              showTimeInput={false}
            />
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
