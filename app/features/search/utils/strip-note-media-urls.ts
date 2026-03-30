/**
 * Remove media URLs from note text when those URLs are rendered as attachments,
 * so the body does not show duplicate raw links next to images.
 */
export function stripRenderedMediaUrlsFromNoteText(
  content: string,
  mediaUrls: string[]
): string {
  if (!content.trim() || mediaUrls.length === 0) return content;

  let out = content;
  const variants = new Set<string>();
  for (const url of mediaUrls) {
    const u = url.trim();
    if (!u) continue;
    variants.add(u);
    variants.add(`nostr:${u}`);
    if (u.startsWith("http://") || u.startsWith("https://")) {
      try {
        const noProto = u.replace(/^https?:\/\//, "");
        variants.add(noProto);
      } catch {
        // ignore
      }
    }
  }

  for (const fragment of variants) {
    if (!fragment) continue;
    const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), "");
  }

  out = out.replace(/\n{3,}/g, "\n\n").trim();

  if (out.length === 0 && mediaUrls.length > 0) {
    return "";
  }

  return out;
}
