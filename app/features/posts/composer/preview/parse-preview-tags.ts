/**
 * Parse space-separated hashtag line (composer tags field) into normalized labels.
 */

export function parsePreviewTagLabels(hashtagLine: string): string[] {
  return hashtagLine
    .split(/\s+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/^#/u, ""));
}
