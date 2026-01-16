import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { useOptionalUser } from "~/lib/remix-utils";

import { getSelectedQueueStyle } from "../queue-colors";
import { isIntervalScheduleConfig, isFixedSlotsScheduleConfig } from "../types";
import type { QueueType, PostData } from "../types";

interface DraftBulkResumeProps {
  selectedDrafts: PostData[];
  queueTypes: QueueType[];
  onCancel: () => void;
}

export default function DraftBulkResume({
  selectedDrafts,
  queueTypes,
  onCancel,
}: DraftBulkResumeProps) {
  const fetcher = useFetcher();
  const user = useOptionalUser();
  const scheduleIntervals =
    user && typeof user === "object" && "scheduleInterval" in user
      ? user.scheduleInterval
      : null;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for bulk operations similar to bulkposts
  const [posts, setPosts] = useState(
    selectedDrafts.map((draft, index) => {
      const now = new Date();
      const userTimezone = user?.timezone ?? "UTC";
      const localDate = new Date(
        now.toLocaleString("en-US", { timeZone: userTimezone })
      );

      // Schedule posts with 2-hour intervals by default
      localDate.setHours(
        localDate.getHours() + index * (Number(scheduleIntervals?.[0]) || 2)
      );
      return {
        id: draft.id,
        content: draft.content ?? draft.caption,
        caption: draft.caption,
        fileUrl: draft.fileUrl,
        postType: draft.postType,
        queueType: draft.queueType?.name ?? draft.queueType ?? "unassigned",
        scheduledFor: localDate
          .toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5"),
      };
    })
  );

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getIntervalHours = (
    config: unknown,
    currentUser: typeof user
  ): number => {
    if (!isIntervalScheduleConfig(config)) {
      return 4; // default
    }

    if (config.useGlobalInterval) {
      const userIntervalRaw =
        currentUser &&
        typeof currentUser === "object" &&
        "scheduleInterval" in currentUser &&
        Array.isArray(currentUser.scheduleInterval) &&
        currentUser.scheduleInterval.length > 0
          ? currentUser.scheduleInterval[0]
          : null;
      const userInterval =
        typeof userIntervalRaw === "number"
          ? userIntervalRaw
          : typeof userIntervalRaw === "string"
            ? Number(userIntervalRaw)
            : null;
      return userInterval && !isNaN(userInterval) ? userInterval : 4;
    }

    return config.intervalHours ?? 4;
  };

  const calculateIntervalOffset = (
    baseDate: Date,
    baseIndex: number,
    config: unknown,
    userData: typeof user
  ): Date => {
    const intervalHours = getIntervalHours(config, userData);
    const offsetDate = new Date(baseDate);
    offsetDate.setHours(offsetDate.getHours() + baseIndex * intervalHours);
    return offsetDate;
  };

  interface ParsedSlot {
    slot: string;
    hours: number;
    minutes: number;
    totalMinutes: number;
  }

  const parseAndSortSlots = (slots: string[]): ParsedSlot[] => {
    return slots
      .map((slot: string) => {
        const parts = slot.split(":");
        const hours = parts[0] ? Number(parts[0]) : 0;
        const minutes = parts[1] ? Number(parts[1]) : 0;
        return {
          slot,
          hours,
          minutes,
          totalMinutes: hours * 60 + minutes,
        };
      })
      .sort((a: ParsedSlot, b: ParsedSlot) => a.totalMinutes - b.totalMinutes);
  };

  const calculateFixedSlotsOffset = (
    baseDate: Date,
    baseIndex: number,
    slots: string[]
  ): Date => {
    if (slots.length === 0) {
      return baseDate;
    }

    const sortedSlots = parseAndSortSlots(slots);

    // Get the current slot index based on the base time
    const baseHours = baseDate.getHours();
    const baseMinutes = baseDate.getMinutes();
    const baseTotalMinutes = baseHours * 60 + baseMinutes;

    let currentSlotIndex = 0;
    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      if (slot && slot.totalMinutes >= baseTotalMinutes) {
        currentSlotIndex = i;
        break;
      }
    }

    // Calculate which slot this post should use
    const targetSlotIndex = (currentSlotIndex + baseIndex) % sortedSlots.length;
    const targetSlot = sortedSlots[targetSlotIndex];

    if (!targetSlot) {
      return baseDate;
    }

    // Calculate how many days to add
    const daysToAdd = Math.floor(
      (currentSlotIndex + baseIndex) / sortedSlots.length
    );

    // Set the time to the target slot
    const offsetDate = new Date(baseDate);
    offsetDate.setHours(targetSlot.hours, targetSlot.minutes, 0, 0);
    offsetDate.setDate(offsetDate.getDate() + daysToAdd);
    return offsetDate;
  };

  const applyScheduleOffset = (
    baseDate: Date,
    baseIndex: number,
    queueType: QueueType
  ): Date => {
    if (baseIndex === 0) {
      return baseDate;
    }

    if (
      typeof queueType !== "object" ||
      !("scheduleType" in queueType) ||
      !queueType.scheduleType
    ) {
      return baseDate;
    }

    const config =
      typeof queueType === "object" && "scheduleConfig" in queueType
        ? queueType.scheduleConfig
        : null;

    if (queueType.scheduleType === "INTERVAL") {
      return calculateIntervalOffset(baseDate, baseIndex, config, user);
    }

    // After checking for INTERVAL, scheduleType must be FIXED_SLOTS
    const slots =
      config && isFixedSlotsScheduleConfig(config) ? config.slots : [];
    return calculateFixedSlotsOffset(baseDate, baseIndex, slots);
  };

  const fetchScheduledTime = async (
    queueTypeName: string
  ): Promise<string | null> => {
    try {
      const response = await fetch("/api/queue-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queueTypeName,
          userId: user?.id,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { scheduledTime?: unknown })
          : {};
      const scheduledTime =
        typeof data.scheduledTime === "string" ? data.scheduledTime : undefined;

      return scheduledTime ?? null;
    } catch (error) {
      const { handleErrorSafely } = await import("~/lib/error-handler.client");
      handleErrorSafely(error, {
        component: "DraftBulkResume",
        action: "fetchScheduledTime",
      });
      return null;
    }
  };

  const calculateQueueScheduleTime = async (
    queueTypeName: string,
    baseIndex = 0
  ): Promise<string> => {
    if (queueTypeName === "unassigned") {
      return "";
    }

    const scheduledTime = await fetchScheduledTime(queueTypeName);
    if (!scheduledTime) {
      return "";
    }

    // For bulk posts, add interval offset based on index
    if (baseIndex > 0) {
      const queueType = queueTypes.find((qt) => {
        const name = typeof qt === "string" ? qt : qt.name;
        return name === queueTypeName;
      });

      if (queueType && typeof queueType === "object") {
        const baseDate = new Date(scheduledTime);
        const offsetDate = applyScheduleOffset(baseDate, baseIndex, queueType);
        return formatDateTimeLocal(offsetDate);
      }
    }

    return scheduledTime;
  };

  const handleQueueTypeChange = async (
    index: number,
    value: string | QueueType
  ) => {
    const updatedPosts = [...posts];
    const postToUpdate = updatedPosts[index];
    if (!postToUpdate) return;
    postToUpdate.queueType = value;

    // Auto-calculate schedule time if not unassigned
    const queueTypeName = typeof value === "string" ? value : value.name;
    if (queueTypeName !== "unassigned") {
      const scheduledTime = await calculateQueueScheduleTime(queueTypeName, 0);
      if (scheduledTime) {
        postToUpdate.scheduledFor = scheduledTime;
      }
    } else {
      postToUpdate.scheduledFor = "";
    }

    setPosts(updatedPosts);
  };

  const handleDateChange = (index: number, value: string) => {
    const updatedPosts = [...posts];
    const postToUpdate = updatedPosts[index];
    if (!postToUpdate) return;
    postToUpdate.scheduledFor = value;
    setPosts(updatedPosts);
  };

  const handleScheduleIntervalClick = (interval: number) => {
    if (posts.length === 0) return;

    const updatedPosts = [...posts];
    const firstPost = updatedPosts[0];
    if (!firstPost?.scheduledFor) return;
    const baseDate = new Date(firstPost.scheduledFor);

    updatedPosts.forEach((post, index) => {
      const newDate = new Date(baseDate);
      newDate.setHours(baseDate.getHours() + index * interval);

      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, "0");
      const day = String(newDate.getDate()).padStart(2, "0");
      const hours = String(newDate.getHours()).padStart(2, "0");
      const minutes = String(newDate.getMinutes()).padStart(2, "0");

      post.scheduledFor = `${year}-${month}-${day}T${hours}:${minutes}`;
    });

    setPosts(updatedPosts);
  };

  const handleBulkQueueUpdate = async (queueType: QueueType | string) => {
    if (posts.length === 0) return;

    const updatedPosts = await Promise.all(
      posts.map(async (post, index) => {
        let scheduledFor = post.scheduledFor;

        // Auto-calculate schedule time if not unassigned
        const queueTypeName =
          typeof queueType === "string" ? queueType : queueType.name;
        if (queueTypeName !== "unassigned") {
          const calculatedTime = await calculateQueueScheduleTime(
            queueTypeName,
            index
          );
          if (calculatedTime) {
            scheduledFor = calculatedTime;
          }
        } else {
          scheduledFor = "";
        }

        return {
          ...post,
          queueType,
          scheduledFor,
        };
      })
    );

    setPosts(updatedPosts);
  };

  const handleSignAndResume = async () => {
    setIsSubmitting(true);
    try {
      // First, collect unique queue types and fetch hashtags in batch
      // This prevents making one API call per post, which can be very slow for bulk operations
      // Helper function to extract queue type name (handles both string and QueueType object)
      const getQueueTypeName = (qt: string | QueueType | undefined): string => {
        if (!qt) return "";
        return typeof qt === "string" ? qt : qt.name;
      };

      const uniqueQueueTypes = new Set(
        posts
          .map((post) => getQueueTypeName(post.queueType))
          .filter((qt) => qt && qt !== "unassigned")
      );

      // Fetch hashtags for all unique queue types in parallel
      const hashtagCache = new Map<string, string>();

      if (uniqueQueueTypes.size > 0) {
        const hashtagPromises = Array.from(uniqueQueueTypes).map(
          async (queueType) => {
            try {
              const response = await fetch("/api/effective-hashtags", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  userId: user?.id,
                  queueTypeName: queueType,
                }),
              });
              const data = (await response.json()) as { hashtags?: string };
              return {
                queueType,
                hashtags: data.hashtags ?? "",
              };
            } catch (error) {
              const { handleErrorSafely } =
                await import("~/lib/error-handler.client");
              handleErrorSafely(error, {
                component: "DraftBulkResume",
                action: "getEffectiveHashtags",
              });
              return { queueType, hashtags: "" };
            }
          }
        );

        const hashtagResults = await Promise.all(hashtagPromises);
        hashtagResults.forEach(({ queueType, hashtags }) => {
          hashtagCache.set(queueType, hashtags);
        });
      }

      // Now create signed posts using cached hashtags
      const signedPosts = await Promise.all(
        posts.map(async (post) => {
          const userTimezone = user?.timezone ?? "UTC";
          let scheduledTime;

          if (userTimezone !== "UTC" && userTimezone !== "Etc/GMT") {
            const utcDate = new Date(post.scheduledFor);
            const userDate = new Date(post.scheduledFor).toLocaleString(
              "en-US",
              {
                timeZone: userTimezone,
              }
            );
            const userOffset =
              (new Date(userDate).getTime() -
                new Date(post.scheduledFor).getTime()) /
              60000;
            utcDate.setMinutes(utcDate.getMinutes() - userOffset);
            scheduledTime = utcDate.getTime();
          } else {
            const dateObj = new Date(post.scheduledFor + "Z");
            scheduledTime = dateObj.getTime();
          }

          const scheduledForUnix = Math.floor(scheduledTime / 1000);

          // Get effective hashtags from cache
          const queueTypeName = getQueueTypeName(post.queueType);
          const tagsString =
            queueTypeName && queueTypeName !== "unassigned"
              ? (hashtagCache.get(queueTypeName) ?? "")
              : "";

          const tagArray = tagsString
            .split(" ")
            .filter((tag) => tag.length > 0)
            .map((tag) => ["t", tag.replace("#", "")]);

          const contentToSign = user?.showHashTagsinPosts
            ? `${post.content ?? ""}\n${tagsString}`
            : (post.content ?? "");

          const { nostrEvent, signedEvent } = await nostrAdapter.signEvent({
            content: contentToSign,
            created_at: scheduledForUnix,
            kind: 1,
            tags: tagArray,
          });

          return {
            id: post.id,
            content: post.content,
            caption: post.caption,
            queueType: post.queueType,
            scheduledFor: scheduledForUnix.toString(),
            signedEvent: JSON.stringify(signedEvent),
            nostrEvent: JSON.stringify(nostrEvent),
          };
        })
      );

      const formData = new FormData();
      formData.append("_action", "bulkSignAndResume");
      signedPosts.forEach((post) => {
        formData.append("postIds", post.id);
        formData.append("contents", post.content ?? "");
        formData.append("captions", post.caption ?? "");
        const queueTypeValue =
          typeof post.queueType === "string"
            ? post.queueType
            : post.queueType.name;
        formData.append("queueTypes", queueTypeValue);
        formData.append("scheduledFors", post.scheduledFor);
        formData.append("signedEvents", post.signedEvent);
        formData.append("nostrEvents", post.nostrEvent);
      });

      fetcher.submit(formData, { method: "post", action: "/dashboard/drafts" });
    } catch (error) {
      console.error("Error signing drafts:", error);
      alert("Error signing drafts. Please try again.");
      setIsSubmitting(false);
    }
  };

  const getImageUrls = (fileUrl: string[] | null | undefined) => {
    if (!fileUrl || fileUrl.length === 0) return [];

    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]) as string[];
      } catch (e) {
        console.error("Error parsing fileUrl:", e);
        return [];
      }
    }

    return fileUrl;
  };

  interface _FetcherData {
    success?: boolean;
  }

  useEffect(() => {
    const dataRaw = fetcher.data;
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as { success?: unknown })
        : null;
    if (data && typeof data.success === "boolean" && data.success) {
      onCancel(); // Close the modal and refresh
    }
  }, [fetcher.data, onCancel]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Resume Draft Posts
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure and sign {posts.length} draft posts before scheduling
          </p>
        </div>

        {/* Schedule Interval Buttons */}
        {posts.length > 0 ? (
          <div className="mt-4 mb-4 flex justify-center">
            {scheduleIntervals
              ? scheduleIntervals.map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    onClick={() =>
                      handleScheduleIntervalClick(
                        typeof interval === "string"
                          ? parseInt(interval, 10)
                          : interval
                      )
                    }
                    disabled={isSubmitting}
                    className="mx-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 shadow-md transition-all hover:scale-105 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    +{interval}h
                  </button>
                ))
              : null}
          </div>
        ) : null}

        {/* Bulk Queue Selection */}
        {posts.length > 0 ? (
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Bulk Queue Selection
            </h3>
            <div className="flex flex-wrap justify-center gap-2">
              {queueTypes.map((queue) => {
                const queueName =
                  typeof queue === "string" ? queue : queue.name;
                const queueColor =
                  typeof queue === "object" ? queue.color : null;
                return (
                  <button
                    key={queueName}
                    type="button"
                    onClick={() => void handleBulkQueueUpdate(queueName)}
                    disabled={isSubmitting}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${getSelectedQueueStyle(queueName, false)}`}
                    style={{
                      backgroundColor: queueColor ?? undefined,
                      borderColor: queueColor ?? undefined,
                    }}
                  >
                    {queueName}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
              Click a queue to update all posts
            </p>
          </div>
        ) : null}

        {/* Posts Configuration Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left">Media</th>
                <th className="p-4 text-left">Content</th>
                <th className="p-4 text-left">Queue</th>
                <th className="p-4 text-left">Schedule</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post, index) => (
                <tr key={post.id} className="border-b">
                  <td className="p-4">
                    {post.fileUrl.length > 0 ? (
                      <img
                        src={getImageUrls(post.fileUrl)[0]}
                        alt="Preview"
                        className="h-24 w-24 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                        TEXT
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="max-h-20 overflow-y-auto">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {post.content?.substring(0, 150) ?? ""}
                        {(post.content?.length ?? 0) > 150 ? "..." : null}
                      </p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {queueTypes.map((queue) => {
                        const queueName =
                          typeof queue === "string" ? queue : queue.name;
                        const queueColor =
                          typeof queue === "object" ? queue.color : null;
                        return (
                          <button
                            key={queueName}
                            type="button"
                            onClick={() => {
                              void handleQueueTypeChange(index, queueName);
                            }}
                            disabled={isSubmitting}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${getSelectedQueueStyle(queueName, post.queueType === queueName)}`}
                            style={{
                              backgroundColor: queueColor ?? undefined,
                              borderColor: queueColor ?? undefined,
                            }}
                          >
                            {queueName}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="p-4">
                    <input
                      type="datetime-local"
                      value={post.scheduledFor}
                      onChange={(e) => handleDateChange(index, e.target.value)}
                      disabled={isSubmitting}
                      className="rounded-lg border p-2 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSignAndResume()}
            disabled={isSubmitting}
            className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-8 py-3 text-sm font-medium text-white shadow-lg transition-all hover:from-green-600 hover:to-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:from-green-300 disabled:to-green-400"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Signing & Scheduling...
              </span>
            ) : (
              `Sign & Schedule ${posts.length} Posts`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
