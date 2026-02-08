/**
 * Client-safe markdown helpers for longform (word count, summary, etc.)
 * Mirrors extractPlainText / generateSummary logic from markdown-sanitizer.server
 * for use in browser (Tiptap editor, preview, listing).
 */

/**
 * Strip markdown syntax to plain text (same logic as extractPlainText in markdown-sanitizer.server).
 */
export function stripMarkdownToPlainText(markdown: string): string {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  return markdown
    .replace(/#+\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/!\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/>\s*/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Generate summary from markdown (strip then truncate at ~280 chars).
 */
export function generateSummaryFromMarkdown(
  markdown: string,
  maxLength = 280
): string {
  const plainText = stripMarkdownToPlainText(markdown);
  if (plainText.length <= maxLength) {
    return plainText;
  }

  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}

/**
 * Generate article identifier from title (for NIP-23 long-form posts).
 * Client-safe; also used by useLongFormSubmission.
 */
export function generateArticleIdentifier(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .substring(0, 64);
}
