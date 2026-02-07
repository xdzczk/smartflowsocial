/**
 * Server-side resolution of [attach:localId] tokens in content.
 * Produces final content (tokens removed) and fileUrl array for NIP-94 / post.
 */

const ATTACH_TOKEN_REGEX = /\[attach:([^\]]+)\]/g;

export interface AttachmentMetaItem {
  localId: string;
  url?: string;
}

export function resolveContentWithTokens(
  content: string,
  attachmentMeta: AttachmentMetaItem[]
): { content: string; fileUrl: string[] } {
  const urlByLocalId = new Map(
    attachmentMeta.filter((a) => a.url).map((a) => [a.localId, a.url as string])
  );
  const fileUrl: string[] = [];
  const contentResolved = content.replace(ATTACH_TOKEN_REGEX, (_, localId) => {
    const url = urlByLocalId.get(localId);
    if (url) {
      fileUrl.push(url);
      return "";
    }
    return "";
  });
  return {
    content: contentResolved.replace(/\n{3,}/g, "\n\n").trim(),
    fileUrl,
  };
}
