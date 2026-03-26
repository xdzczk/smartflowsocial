/**
 * Media URL extraction for Nostr note content and tags (shared by search + thread APIs).
 */

export function extractMediaUrlsFromContent(content: string): string[] {
  const urlRegex =
    /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov))/gi;
  return content.match(urlRegex) ?? [];
}

export function extractMediaUrlsFromTags(tags: string[][]): string[] {
  const urls: string[] = [];
  for (const tag of tags) {
    if (!Array.isArray(tag) || tag.length < 2) continue;
    if (
      tag[0] === "url" &&
      typeof tag[1] === "string" &&
      /^https?:\/\//i.test(tag[1])
    ) {
      urls.push(tag[1]);
    }
    if (
      tag[0] === "imeta" &&
      tag.length >= 3 &&
      typeof tag[2] === "string" &&
      /^https?:\/\//i.test(tag[2])
    ) {
      urls.push(tag[2]);
    }
  }
  return urls;
}
