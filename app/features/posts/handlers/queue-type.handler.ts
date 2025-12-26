/**
 * Queue Type Handlers for Bulk Posts
 * 
 * Handles queue type changes for individual and bulk posts
 */

import type { BulkPost, BulkPostsHandlerDeps, QueueType } from "~/features/posts/types";
import {
  isIntervalScheduleConfig,
  isFixedSlotsScheduleConfig,
} from "~/features/posts/types";
import { logClientError } from "~/lib/error-handler.client";
import { updateDisplayedHashtags } from "./hashtag.handler";

/**
 * Handle queue type change for a single post
 */
export async function handleQueueTypeChange(
  index: number,
  value: string,
  deps: Pick<
    BulkPostsHandlerDeps,
    | "posts"
    | "setPosts"
    | "queueTypes"
    | "tags"
    | "user"
    | "setDisplayedHashtags"
    | "setSelectedQueueType"
  >,
): Promise<void> {
  const {
    posts,
    setPosts,
    queueTypes,
    tags,
    user,
    setDisplayedHashtags,
    setSelectedQueueType,
  } = deps;
  const updatedPosts = [...posts];
  updatedPosts[index].queueType = value;

  // Find the queue type object to get its ID
  const selectedQueueType = queueTypes.find(
    (qt) => (typeof qt === "string" ? qt : qt.name) === value,
  );
  const queueTypeId =
    typeof selectedQueueType === "object" ? selectedQueueType.id : null;

  // Auto-calculate schedule time if not unassigned
  if (value !== "unassigned" && queueTypeId) {
    try {
      const requestBody = {
        queueTypeId,
        queueTypeName: value, // Keep for backward compatibility
        userId: user?.id,
      };

      const response = await fetch("/api/queue-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const responseData = await response.json();
        const { scheduledTime } = responseData;
        if (scheduledTime) {
          updatedPosts[index].scheduledFor = scheduledTime;
        }
      }
    } catch (error) {
      logClientError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: "bulkposts",
          action: "handleQueueTypeChange",
          queueType: value,
        },
      );
    }
  } else {
    updatedPosts[index].scheduledFor = "";
  }

  setPosts(updatedPosts);

  // Update displayed hashtags if this is the predominant queue type
  const queueTypeCounts: Record<string, number> = {};
  updatedPosts.forEach((post) => {
    queueTypeCounts[post.queueType] =
      (queueTypeCounts[post.queueType] || 0) + 1;
  });

  const mostUsedQueueType = Object.keys(queueTypeCounts).reduce(
    (a, b) => (queueTypeCounts[a] > queueTypeCounts[b] ? a : b),
    "unassigned",
  );

  if (mostUsedQueueType !== value) {
    await updateDisplayedHashtags(
      mostUsedQueueType,
      queueTypes,
      tags,
      setSelectedQueueType,
      setDisplayedHashtags,
    );
  }
}

/**
 * Handle bulk queue update for all posts
 */
export async function handleBulkQueueUpdate(
  queueType: string,
  deps: Pick<
    BulkPostsHandlerDeps,
    | "posts"
    | "setPosts"
    | "queueTypes"
    | "tags"
    | "user"
    | "setDisplayedHashtags"
    | "setSelectedQueueType"
    | "firstItemTimeManuallyChanged"
  >,
): Promise<void> {
  const {
    posts,
    setPosts,
    queueTypes,
    tags,
    user,
    setDisplayedHashtags,
    setSelectedQueueType,
    firstItemTimeManuallyChanged,
  } = deps;

  if (posts.length === 0) return;

  // Update displayed hashtags
  await updateDisplayedHashtags(
    queueType,
    queueTypes,
    tags,
    setSelectedQueueType,
    setDisplayedHashtags,
  );

  // Get the base schedule time from the API (this is the next available time after last scheduled post)
  let baseTime: string | null = null;
  if (queueType !== "unassigned") {
    // If first item time was manually changed, use it as base
    if (firstItemTimeManuallyChanged && posts[0].scheduledFor) {
      baseTime = posts[0].scheduledFor;
    } else {
      // Original behavior - fetch from API
      const selectedQueueType = queueTypes.find(
        (qt) => (typeof qt === "string" ? qt : qt.name) === queueType,
      );
      const queueTypeId =
        typeof selectedQueueType === "object" ? selectedQueueType.id : null;

      const requestBody = {
        queueTypeId,
        queueTypeName: queueType, // Keep for backward compatibility
        userId: user?.id,
      };

      const response = await fetch("/api/queue-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const responseData = await response.json();
        const { scheduledTime } = responseData;
        baseTime = scheduledTime;
      }
    }
  }

  // Find the queue type configuration for bulk scheduling
  const queueTypeConfig = queueTypes.find(
    (qt) => qt.name === queueType,
  ) as QueueType | undefined;

  const updatedPosts = posts.map((post, index) => {
    let scheduledFor = post.scheduledFor;

    // Auto-calculate schedule time if not unassigned
    if (queueType !== "unassigned" && baseTime && queueTypeConfig) {
      // Calculate each post's time based on the base time + offsets
      const baseDate = new Date(baseTime);
      let calculatedTime = "";

      if (queueTypeConfig.scheduleType === "INTERVAL") {
        const config = queueTypeConfig.scheduleConfig;
        let intervalHours = 4; // default

        if (config && isIntervalScheduleConfig(config)) {
          if (config.useGlobalInterval) {
            intervalHours = user?.scheduleInterval?.[0] || 4;
          } else {
            intervalHours = config.intervalHours || 4;
          }
        }

        // Add interval * index to base time
        const newDate = new Date(baseDate);
        newDate.setHours(newDate.getHours() + index * intervalHours);

        // Format back to datetime-local format
        const year = newDate.getFullYear();
        const month = String(newDate.getMonth() + 1).padStart(2, "0");
        const day = String(newDate.getDate()).padStart(2, "0");
        const hours = String(newDate.getHours()).padStart(2, "0");
        const minutes = String(newDate.getMinutes()).padStart(2, "0");

        calculatedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
      } else if (queueTypeConfig.scheduleType === "FIXED_SLOTS") {
        const config = queueTypeConfig.scheduleConfig;
        const slots =
          config && isFixedSlotsScheduleConfig(config) ? config.slots : [];

        if (slots.length > 0) {
          // Sort slots to ensure consistent ordering
          const sortedSlots = slots
            .map((slot) => {
              const [hours, minutes] = slot.split(":").map(Number);
              return {
                slot,
                hours,
                minutes,
                totalMinutes: hours * 60 + minutes,
              };
            })
            .sort((a, b) => a.totalMinutes - b.totalMinutes);

          // Get the current slot index based on the base time
          const baseHours = baseDate.getHours();
          const baseMinutes = baseDate.getMinutes();
          const baseTotalMinutes = baseHours * 60 + baseMinutes;

          let currentSlotIndex = 0;
          for (let i = 0; i < sortedSlots.length; i++) {
            if (sortedSlots[i].totalMinutes >= baseTotalMinutes) {
              currentSlotIndex = i;
              break;
            }
          }

          // Calculate which slot this post should use
          const targetSlotIndex =
            (currentSlotIndex + index) % sortedSlots.length;
          const targetSlot = sortedSlots[targetSlotIndex];

          // Calculate how many days to add
          const daysToAdd = Math.floor(
            (currentSlotIndex + index) / sortedSlots.length,
          );

          // Set the time to the target slot
          const newDate = new Date(baseDate);
          newDate.setHours(targetSlot.hours, targetSlot.minutes, 0, 0);
          newDate.setDate(newDate.getDate() + daysToAdd);

          // Format back to datetime-local format
          const year = newDate.getFullYear();
          const month = String(newDate.getMonth() + 1).padStart(2, "0");
          const day = String(newDate.getDate()).padStart(2, "0");
          const hours = String(newDate.getHours()).padStart(2, "0");
          const minutes = String(newDate.getMinutes()).padStart(2, "0");

          calculatedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
      }

      if (calculatedTime) {
        scheduledFor = calculatedTime;
      }
    } else if (queueType === "unassigned") {
      scheduledFor = "";
    }

    return {
      ...post,
      queueType,
      scheduledFor,
    };
  });

  setPosts(updatedPosts);
}

