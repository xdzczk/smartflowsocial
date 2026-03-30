import sanitizeHtml from "sanitize-html";

/**
 * Converts stored rich HTML (e.g. longform article bodies) to plain text for list/sheet previews.
 * Block boundaries become newlines so words do not run together after tag removal.
 */
export function richContentToPlainPreview(raw: string): string {
  if (!raw || typeof raw !== "string") {
    return "";
  }

  const normalized = raw.replace(/\\n/g, "\n").replace(/\\t/g, "\t").trim();

  const spaced = normalized
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(
      /<\/\s*(p|div|h[1-6]|li|blockquote|pre|section|article)\s*>/gi,
      "\n"
    )
    .replace(/<\s*(p|div|h[1-6]|blockquote)[^>]*>/gi, "\n");

  const stripped = sanitizeHtml(spaced, {
    allowedTags: [],
    allowedAttributes: {},
  });

  return stripped.replace(/\n{3,}/g, "\n\n").trim();
}
