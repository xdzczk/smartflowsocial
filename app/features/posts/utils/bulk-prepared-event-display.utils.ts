/**
 * Pure helpers for displaying prepared bulk events (review / confirmation).
 */

export function getEventsKind(eventsData: unknown): number | undefined {
  if (
    typeof eventsData === "object" &&
    eventsData !== null &&
    "kind" in eventsData
  ) {
    return (eventsData as { kind?: unknown }).kind as number | undefined;
  }
  return undefined;
}

export function getEventsContent(eventsData: unknown): string | undefined {
  if (
    typeof eventsData === "object" &&
    eventsData !== null &&
    "content" in eventsData
  ) {
    const content = (eventsData as { content?: unknown }).content;
    return typeof content === "string" ? content : undefined;
  }
  return undefined;
}

export function getEventsTags(eventsData: unknown): unknown {
  if (
    typeof eventsData === "object" &&
    eventsData !== null &&
    "tags" in eventsData
  ) {
    return (eventsData as { tags?: unknown }).tags;
  }
  return undefined;
}

const HTTP_URL_RE = /^https?:\/\/\S+$/i;

function isHttpUrlToken(value: string): boolean {
  return (
    value.trim() !== "" && value !== "null" && HTTP_URL_RE.test(value.trim())
  );
}

/** Matches bulk `buildContent` layout: media URL lines, then caption, then tags. */
export function parseContentForRegularPost(
  eventsContent: string,
  fallbackCaption: string,
  fallbackFileUrl: string
): { caption: string; mediaUrl: string } {
  const trimmed = eventsContent.trim();
  if (!trimmed) {
    return { caption: fallbackCaption, mediaUrl: fallbackFileUrl };
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const mediaUrls: string[] = [];
  const captionLines: string[] = [];

  for (const line of lines) {
    if (isHttpUrlToken(line)) {
      mediaUrls.push(line);
      continue;
    }
    if (line !== "null") {
      captionLines.push(line);
    }
  }

  const [firstMediaUrl] = mediaUrls;
  if (firstMediaUrl) {
    return {
      caption:
        captionLines.length > 0 ? captionLines.join("\n") : fallbackCaption,
      mediaUrl: firstMediaUrl,
    };
  }

  // Legacy space-separated content (caption and URL on one line).
  const contentParts = trimmed
    .split(/\s+/)
    .filter((part) => part !== "" && part !== "null");
  const inlineMediaUrl = contentParts.find((part) => isHttpUrlToken(part));

  if (inlineMediaUrl) {
    const captionParts = contentParts.filter((part) => !isHttpUrlToken(part));
    return {
      caption:
        captionParts.length > 0 ? captionParts.join(" ") : fallbackCaption,
      mediaUrl: inlineMediaUrl,
    };
  }

  return {
    caption:
      captionLines.length > 0 ? captionLines.join("\n") : fallbackCaption,
    mediaUrl: fallbackFileUrl,
  };
}

export function extractTagsFromEvents(eventsTags: unknown): string {
  if (!Array.isArray(eventsTags)) {
    return "";
  }
  return eventsTags
    .map((tag) =>
      Array.isArray(tag) && typeof tag[1] === "string" ? `#${tag[1]}` : ""
    )
    .filter((t) => t !== "")
    .join(" ");
}

export function getCreatedAtTimestamp(eventsData: unknown): number {
  if (
    typeof eventsData === "object" &&
    eventsData !== null &&
    "created_at" in eventsData &&
    typeof (eventsData as { created_at?: unknown }).created_at === "number"
  ) {
    return (eventsData as { created_at: number }).created_at;
  }
  return 0;
}
