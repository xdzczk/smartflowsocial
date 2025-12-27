/**
 * Post State Handlers for Bulk Posts
 * 
 * Handles individual post state changes (caption, date, removal)
 */

import type { BulkPost } from "~/features/posts/types";
/**
 * Handle caption change for a post
 */
export function handleCaptionChange(
  index: number,
  value: string,
  posts: BulkPost[],
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>,
): void {
  const updatedPosts = [...posts];
  updatedPosts[index].caption = value;
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
  setFirstItemTimeManuallyChanged: (changed: boolean) => void,
): void {
  const updatedPosts = [...posts];

  // Handle empty string
  if (!value || value.trim() === "") {
    updatedPosts[index].scheduledFor = "";
    setPosts(updatedPosts);
    return;
  }

  // Parse the input value
  const localDate = new Date(value);

  // Check if date is invalid
  if (isNaN(localDate.getTime())) {
    updatedPosts[index].scheduledFor = "";
    setPosts(updatedPosts);
    return;
  }

  const hours = localDate.getHours();

  // Create a new date string maintaining the hours exactly as input
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  const minutes = String(localDate.getMinutes()).padStart(2, "0");

  // Format the date string manually to ensure hour isn't converted
  const formattedDate = `${year}-${month}-${day}T${String(hours).padStart(2, "0")}:${minutes}`;

  updatedPosts[index].scheduledFor = formattedDate;

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
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>,
): void {
  setPosts(posts.filter((_, i) => i !== index));
}




