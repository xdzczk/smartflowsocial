/**
 * Schedule Interval Handler for Bulk Posts
 * 
 * Handles applying schedule intervals to all posts
 */

import type { BulkPost } from "~/features/posts/types";
/**
 * Apply schedule interval to all posts
 */
export function handleScheduleIntervalClick(
  interval: number,
  posts: BulkPost[],
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>,
  firstItemTimeManuallyChanged: boolean,
): void {
  if (posts.length === 0) return;

  const updatedPosts = [...posts];

  let baseDate: Date;

  // If first item time was manually changed, use it as base
  if (firstItemTimeManuallyChanged && updatedPosts[0].scheduledFor) {
    baseDate = new Date(updatedPosts[0].scheduledFor);
  } else {
    // Original behavior - use first post's scheduled time or current time
    const firstPost = updatedPosts[0];
    baseDate = firstPost.scheduledFor
      ? new Date(firstPost.scheduledFor)
      : new Date();
  }

  // Update each post's scheduled time based on the interval
  updatedPosts.forEach((post, index) => {
    const newDate = new Date(baseDate);
    newDate.setHours(baseDate.getHours() + index * interval);

    // Format the date string
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, "0");
    const day = String(newDate.getDate()).padStart(2, "0");
    const hours = String(newDate.getHours()).padStart(2, "0");
    const minutes = String(newDate.getMinutes()).padStart(2, "0");

    post.scheduledFor = `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  setPosts(updatedPosts);
}








