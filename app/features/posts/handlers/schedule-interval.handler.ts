/**
 * Schedule Interval Handler for Bulk Posts
 *
 * Handles applying schedule intervals to all posts
 */

import {
  addHours,
  addMinutes,
  formatForDateTimeLocal,
  nowUTC,
  parseDateTimeLocal,
} from "~/lib/temporal";

import type { BulkPost } from "../types";
/**
 * Apply schedule interval to all posts
 */
export function handleScheduleIntervalClick(
  interval: number,
  posts: BulkPost[],
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>,
  firstItemTimeManuallyChanged: boolean
): void {
  if (posts.length === 0) return;

  const updatedPosts = [...posts];

  let baseZonedDateTime;

  // If first item time was manually changed, use it as base
  const firstPost = updatedPosts[0];
  if (firstItemTimeManuallyChanged && firstPost?.scheduledFor) {
    // Parse datetime-local string (assumed to be in UTC for consistency)
    baseZonedDateTime = parseDateTimeLocal(firstPost.scheduledFor, "UTC");
  } else {
    // Original behavior - use first post's scheduled time or current time
    const firstPost = updatedPosts[0];
    if (!firstPost) {
      baseZonedDateTime = addMinutes(nowUTC(), 15);
    } else {
      baseZonedDateTime = firstPost.scheduledFor
        ? parseDateTimeLocal(firstPost.scheduledFor, "UTC")
        : addMinutes(nowUTC(), 15);
    }
  }

  // Update each post's scheduled time based on the interval
  updatedPosts.forEach((post, index) => {
    // Add hours using Temporal (immutable operation)
    const newZonedDateTime = addHours(baseZonedDateTime, index * interval);

    // Format back to datetime-local string
    post.scheduledFor = formatForDateTimeLocal(newZonedDateTime, "UTC");
  });

  setPosts(updatedPosts);
}
