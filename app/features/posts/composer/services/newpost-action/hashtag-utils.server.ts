/**
 * Hashtag utility functions
 */

/**
 * Per-post toggle from FormData (thread / drafts that skip Zod union).
 * When the field is absent, use `defaultWhenAbsent` (typically `true` for older clients).
 */
export function parseIncludeHashtagsInNoteBodyFromForm(
  formData: FormData,
  defaultWhenAbsent: boolean
): boolean {
  const raw = formData.get("includeHashtagsInNoteBody");
  if (raw == null || raw === "") return defaultWhenAbsent;
  const s = String(raw);
  if (s === "true" || s === "on") return true;
  if (s === "false" || s === "off") return false;
  return defaultWhenAbsent;
}

/** Effective body append: account setting and per-post switch must both allow. */
export function effectiveAppendHashtagsToNoteBody(
  userAllows: boolean,
  perPostInclude: boolean
): boolean {
  return userAllows && perPostInclude;
}

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
