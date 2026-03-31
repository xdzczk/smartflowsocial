/**
 * Normalize hashtag preset tag strings: trim, ensure # prefix, dedupe, single-space join.
 */
export function normalizeHashtagPresetTags(input: string): string {
  const parts = input
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .filter((t) => t.length > 1);
  return [...new Set(parts)].join(" ");
}
