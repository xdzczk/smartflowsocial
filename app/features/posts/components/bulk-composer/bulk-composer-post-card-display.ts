import type { PreparedEvent } from "~/features/posts/types";
import {
  extractTagsFromEvents,
  getCreatedAtTimestamp,
  getEventsContent,
  getEventsKind,
  getEventsTags,
  parseContentForRegularPost,
} from "~/features/posts/utils/bulk-prepared-event-display.utils";
import type { DateDisplayLocale } from "~/lib/temporal";
import { formatForDisplay, fromUnixTimestamp } from "~/lib/temporal";

export interface BulkComposerReviewDisplay {
  mediaUrl: string;
  caption: string;
  tags: string;
  isRepost: boolean;
  scheduledLabel: string;
}

export function computeBulkComposerReviewDisplay(
  preparedEvent: PreparedEvent,
  userTimezone: string,
  userTimeFormat: "12h" | "24h",
  dateLocale: DateDisplayLocale
): BulkComposerReviewDisplay {
  const eventsData = preparedEvent.events;
  const kind = getEventsKind(eventsData);
  const isRepost = kind === 6;
  const preparedMediaUrl =
    preparedEvent.fileUrl.find(
      (url) => typeof url === "string" && url.trim().length > 0
    ) ?? "";
  let mediaUrl = preparedMediaUrl;
  let caption = "";
  let tags = "";
  if (isRepost) {
    caption = preparedEvent.caption;
  } else {
    const content = getEventsContent(eventsData);
    if (content) {
      const parsed = parseContentForRegularPost(
        content,
        preparedEvent.caption,
        preparedMediaUrl
      );
      caption = parsed.caption;
      mediaUrl = parsed.mediaUrl || preparedMediaUrl;
    } else {
      caption = preparedEvent.caption;
      mediaUrl = preparedMediaUrl;
    }
    tags = extractTagsFromEvents(getEventsTags(eventsData));
  }
  let scheduledLabel = "";
  try {
    const ts =
      typeof preparedEvent.scheduledFor === "number"
        ? preparedEvent.scheduledFor
        : getCreatedAtTimestamp(eventsData);
    const zoned = fromUnixTimestamp(ts, "UTC").withTimeZone(userTimezone);
    scheduledLabel = formatForDisplay(
      zoned,
      userTimezone,
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: userTimeFormat === "12h",
      },
      userTimeFormat,
      dateLocale
    );
  } catch {
    scheduledLabel = "—";
  }
  return { mediaUrl, caption, tags, isRepost, scheduledLabel };
}
