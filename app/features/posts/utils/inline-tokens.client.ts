/**
 * Legacy `[attach:localId]` markers in composer text: strip when hydrating or signing.
 */

export const ATTACH_TOKEN_REGEX = /\[attach:([^\]]+)\]/g;

/**
 * Remove all attachment tokens and collapse extra newlines (keeps non-token text).
 */
export function stripAttachmentTokens(content: string): string {
  return content
    .replace(ATTACH_TOKEN_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/**
 * Append Blossom (or other) media URLs after the note body for kind 1 signing.
 * `urls` should follow composer strip order.
 */
export function appendMediaUrlsForSigning(
  contentBeforeUrls: string,
  urls: string[]
): string {
  const filtered = urls.map((u) => u.trim()).filter((u) => u.length > 0);
  if (filtered.length === 0) return contentBeforeUrls;
  const block = filtered.join("\n");
  if (contentBeforeUrls.trim().length === 0) return block;
  return `${contentBeforeUrls.trimEnd()}\n\n${block}`;
}
