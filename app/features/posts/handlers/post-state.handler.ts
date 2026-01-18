/**
 * Post State Handlers for Bulk Posts
 *
 * Handles individual post state changes (caption, date, removal)
 */

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
  const post = updatedPosts[index];
  if (!post) return;

  // Handle empty string
  if (!value || value.trim() === "") {
    post.scheduledFor = "";
    setPosts(updatedPosts);
    return;
  }

  // `datetime-local` inputs already emit a normalized value string.
  // Avoid re-parsing/re-formatting here to prevent disrupting typing/caret.
  post.scheduledFor = value;

  // Set flag if user manually changed the first item's time
  if (index === 0) {
    setFirstItemTimeManuallyChanged(true);
  }

  setPosts(updatedPosts);
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
