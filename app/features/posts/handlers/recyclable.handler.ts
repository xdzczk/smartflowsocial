/**
 * Recyclable Handlers for Bulk Posts
 * 
 * Handles recyclable status toggling for individual and bulk posts
 */

import type { BulkPost } from "~/features/posts/types";
/**
 * Handle recyclable checkbox change for a post
 */
export function handleIsRecyclableChange(
  index: number,
  checked: boolean,
  posts: BulkPost[],
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>,
): void {
  const updatedPosts = [...posts];
  updatedPosts[index].isRecyclable = checked;
  setPosts(updatedPosts);
}

/**
 * Toggle all posts' recyclable status
 */
export function handleBulkRecyclableToggle(
  posts: BulkPost[],
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>,
): void {
  if (posts.length === 0) return;

  // Check if all posts are currently recyclable
  const allRecyclable = posts.every((post) => post.isRecyclable);

  // Toggle all posts to the opposite state
  const updatedPosts = posts.map((post) => ({
    ...post,
    isRecyclable: !allRecyclable,
  }));

  setPosts(updatedPosts);
}







