/**
 * Strip legacy `[attach:localId]` from composer content and derive `fileUrl`
 * in attachment strip / attachmentMeta order (not token order).
 */

const ATTACH_TOKEN_REGEX = /\[attach:([^\]]+)\]/g;

export interface AttachmentMetaItem {
  localId: string;
  url?: string;
}

/**
 * Removes inline attachment tokens from text and builds `fileUrl` from
 * `attachmentMeta` array order (matches composer strip order).
 */
export function prepareComposerTextAndFileUrls(
  content: string,
  attachmentMeta: AttachmentMetaItem[]
): { content: string; fileUrl: string[] } {
  const contentStripped = content.replace(ATTACH_TOKEN_REGEX, "");
  const contentNormalized = contentStripped.replace(/\n{3,}/g, "\n\n").trim();
  const fileUrl = attachmentMeta
    .map((a) => a.url)
    .filter((u): u is string => Boolean(u));
  return { content: contentNormalized, fileUrl };
}
