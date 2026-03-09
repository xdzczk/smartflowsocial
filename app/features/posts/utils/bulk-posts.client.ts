import type { BulkPost } from "~/features/posts/types";

/**
 * Build fileUrl array for a post (for save-as-draft payload).
 */
export function getFileUrlArrayForDraft(post: BulkPost): string[] {
  if (Array.isArray(post.fileUrl)) {
    return post.fileUrl.filter((u): u is string => typeof u === "string");
  }
  if (typeof post.fileUrl === "string" && post.fileUrl.trim() !== "") {
    return [post.fileUrl];
  }
  return [];
}
