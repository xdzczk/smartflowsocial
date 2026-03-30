/**
 * Form parsing and hashtag preset resolution for new longform actions.
 */

import { getHashTagPresetById, getQueueTypes } from "~/features/user";

export const ERROR_TITLE_REQUIRED = "Title is required";
export const ERROR_CONTENT_REQUIRED = "Content is required";

export interface QuoteScheduleItem {
  scheduledFor: number;
  signedEvent: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    content: string;
    tags: string[][];
    sig: string;
  };
  caption?: string;
}

export function parseQuoteSchedulesFromForm(
  formData: FormData
): QuoteScheduleItem[] {
  const quoteSchedulesStr = formData.get("quoteSchedules");
  const alsoScheduleQuote = formData.get("alsoScheduleQuote") === "on";
  const quoteScheduledForStr = formData.get("quoteScheduledFor");
  const quoteSignedEventStr = formData.get("quoteSignedEvent");
  const quoteCaption = formData.get("quoteCaption");
  let list: QuoteScheduleItem[] = [];
  if (quoteSchedulesStr && typeof quoteSchedulesStr === "string") {
    try {
      const parsed = JSON.parse(quoteSchedulesStr) as unknown;
      if (Array.isArray(parsed)) {
        list = parsed.filter(
          (p): p is QuoteScheduleItem =>
            typeof p === "object" &&
            p !== null &&
            "scheduledFor" in p &&
            "signedEvent" in p &&
            typeof (p as QuoteScheduleItem).scheduledFor === "number" &&
            typeof (p as QuoteScheduleItem).signedEvent === "object"
        );
      }
    } catch {
      list = [];
    }
  }
  if (
    list.length === 0 &&
    alsoScheduleQuote &&
    quoteScheduledForStr &&
    quoteSignedEventStr
  ) {
    const quoteScheduledFor = parseInt(String(quoteScheduledForStr), 10);
    if (!Number.isNaN(quoteScheduledFor)) {
      try {
        const quoteSignedEvent = JSON.parse(
          String(quoteSignedEventStr)
        ) as QuoteScheduleItem["signedEvent"];
        list = [
          {
            scheduledFor: quoteScheduledFor,
            signedEvent: quoteSignedEvent,
            caption: quoteCaption ? String(quoteCaption) : undefined,
          },
        ];
      } catch {
        // keep empty
      }
    }
  }
  return list;
}

/**
 * Parse and combine tags from form data
 */
export function parseTags(formData: FormData): string[] {
  const tags =
    formData
      .get("tags")
      ?.toString()
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean) ?? [];

  const customTags = formData.get("customTags")?.toString() ?? "";

  // If there are custom tags input separately, parse and combine them
  if (customTags) {
    const customTagsList = customTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    // Add custom tags to the existing tags array and deduplicate
    const allTags = [...tags, ...customTagsList];
    return allTags.filter(
      (tag, index) =>
        allTags.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) ===
        index
    );
  }

  return tags;
}

/**
 * Get hashtag preset tags based on user selection and queue type
 */
export async function getHashtagPresetTags(
  userId: string,
  useHashtagPresets: boolean,
  manualHashTagPresetId: string | null,
  queueType: string
): Promise<{ tags: string; presetId: string | null }> {
  let hashTagPresetTags = "";
  let hashTagPresetId = null;

  if (useHashtagPresets) {
    // Manual hashtag presets are enabled
    if (manualHashTagPresetId) {
      // Use manually selected hashtag preset
      const preset = await getHashTagPresetById(userId, manualHashTagPresetId);
      hashTagPresetTags = preset?.tags ?? "";
      hashTagPresetId = manualHashTagPresetId;
    }
    // If useHashtagPresets is true but no manual preset selected, use no hashtags
    // This ensures manual hashtag preset selection overrides queue defaults
  } else {
    // Manual hashtag presets are disabled, use queue type's default hashtag preset
    if (queueType !== "Unassigned") {
      const queueTypes = await getQueueTypes(userId);
      const selectedQueueType = queueTypes.find((qt) => qt.name === queueType);
      if (
        selectedQueueType &&
        "hashTagPreset" in selectedQueueType &&
        selectedQueueType.hashTagPreset
      ) {
        const preset = selectedQueueType.hashTagPreset;
        if (
          typeof preset === "object" &&
          "tags" in preset &&
          typeof preset.tags === "string"
        ) {
          hashTagPresetTags = preset.tags;
        }
        if (
          typeof preset === "object" &&
          "id" in preset &&
          typeof preset.id === "string"
        ) {
          hashTagPresetId = preset.id;
        }
      }
    }
  }

  return { tags: hashTagPresetTags, presetId: hashTagPresetId };
}
