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

export function parseContentForRegularPost(
  eventsContent: string,
  fallbackCaption: string,
  fallbackFileUrl: string
): { caption: string; mediaUrl: string } {
  const contentParts = eventsContent.split(" ");
  const mediaUrl =
    contentParts.find(
      (part) =>
        part && part.trim() !== "" && part !== "null" && part.startsWith("http")
    ) ?? "";

  const captionParts = contentParts.filter(
    (part) =>
      part && part.trim() !== "" && part !== "null" && !part.startsWith("http")
  );

  return {
    caption: captionParts.length > 0 ? captionParts.join(" ") : fallbackCaption,
    mediaUrl: mediaUrl || fallbackFileUrl,
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
