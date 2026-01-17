/**
 * Post State Handlers for Bulk Posts
 *
 * Handles individual post state changes (caption, date, removal)
 */

import { formatForDateTimeLocal, parseDateTimeLocal } from "~/lib/temporal";

import type { BulkPost } from "../types";
/**
 * Handle caption change for a post
 */
export function handleCaptionChange(
  index: number,
  value: string,
  posts: BulkPost[],
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>
): void {
  const updatedPosts = [...posts];
  const post = updatedPosts[index];
  if (!post) return;
  post.caption = value;
  setPosts(updatedPosts);
}

/**
 * Handle date/time change for a post
 */
export function handleDateChange(
  index: number,
  value: string,
  posts: BulkPost[],
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>,
  setFirstItemTimeManuallyChanged: (changed: boolean) => void
): void {
  const updatedPosts = [...posts];

  // Handle empty string
  if (!value || value.trim() === "") {
    const post = updatedPosts[index];
    if (!post) return;
    post.scheduledFor = "";
    setPosts(updatedPosts);
    return;
  }

  try {
    // Parse the datetime-local input string (assumed to be in UTC for consistency)
    // The datetime-local format doesn't include timezone, so we interpret as UTC
    const zonedDateTime = parseDateTimeLocal(value, "UTC");

    // Format back to datetime-local string (maintains the exact time components)
    const formattedDate = formatForDateTimeLocal(zonedDateTime, "UTC");

    const post = updatedPosts[index];
    if (!post) return;
    post.scheduledFor = formattedDate;

    // Set flag if user manually changed the first item's time
    if (index === 0) {
      setFirstItemTimeManuallyChanged(true);
    }

    setPosts(updatedPosts);
  } catch {
    // If parsing fails, clear the scheduled time
    const post = updatedPosts[index];
    if (!post) return;
    post.scheduledFor = "";
    setPosts(updatedPosts);
  }
}

/**
 * Remove a post at the given index
 */
export function handleRemovePost(
  index: number,
  posts: BulkPost[],
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>
): void {
  setPosts(posts.filter((_, i) => i !== index));
}
