/**
 * Hashtag utility functions
 */

/**
 * Apply hashtags to content based on user preferences
 */
export function applyHashtags(
  content: string,
  hashTagPresetTags: string,
  showHashTagsinPosts: boolean
): string {
  if (!showHashTagsinPosts || !hashTagPresetTags) {
    return content;
  }

  // Check if hashtags are already in content
  const hashtagsInContent = hashTagPresetTags
    .split(" ")
    .some((tag) => content.includes(tag));

  if (hashtagsInContent) {
    return content;
  }

  // Add hashtags on a new line for better formatting
  return `${content}\n${hashTagPresetTags}`.trim();
}
