/**
 * Hook for handling longform post submission logic
 * Extracts the complex submission logic from LongFormPost component
 */

import {
  convertEditorJSToMarkdown,
  generateArticleIdentifier,
} from "~/features/posts/utils/editorjs-conversion";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  fromDate,
  fromISOString,
  nowSeconds,
  parseDateTimeLocal,
  toUnixTimestamp,
} from "~/lib/temporal";

import type { EditorJSBlock } from "../types";
import { generateSummaryFromContent } from "../utils/editorjs-content";

interface UseLongFormSubmissionProps {
  title: string;
  summary: string;
  content: string;
  image: string;
  customTags: string;
  selectedQueueType: string;
  scheduledFor: string | null;
  displayedHashtags: string | null;
  useHashtagPresets: boolean;
  selectedHashtags: string;
}

export function useLongFormSubmission({
  title,
  summary,
  content,
  image,
  customTags,
  selectedQueueType,
  scheduledFor,
  displayedHashtags,
  useHashtagPresets,
  selectedHashtags,
}: UseLongFormSubmissionProps) {
  const handleSchedule = async (actionType: "schedule" | "publish") => {
    if (!title.trim() || !content.trim()) {
      return;
    }

    try {
      let markdownContent;
      try {
        const editorData = JSON.parse(content) as { blocks?: EditorJSBlock[] };
        markdownContent = convertEditorJSToMarkdown(
          editorData as { blocks: EditorJSBlock[] }
        );
      } catch {
        markdownContent = content;
      }

      const finalSummary = summary || generateSummaryFromContent(content);
      const identifier = generateArticleIdentifier(title);

      /**
       * Parse scheduled timestamp with fallbacks
       */
      async function parseScheduledTimestamp(
        scheduledForValue: string
      ): Promise<number | undefined> {
        try {
          const userTimezone = "UTC"; // Default, could be passed as prop
          const zoned = parseDateTimeLocal(scheduledForValue, userTimezone);
          const utcZoned = zoned.withTimeZone("UTC");
          return toUnixTimestamp(utcZoned);
        } catch {
          try {
            const zoned = fromISOString(scheduledForValue, "UTC");
            return toUnixTimestamp(zoned);
          } catch {
            try {
              const scheduledTime = new Date(scheduledForValue);
              if (!isNaN(scheduledTime.getTime())) {
                const zoned = fromDate(scheduledTime, "UTC");
                return toUnixTimestamp(zoned);
              }
            } catch {
              const scheduledTime = new Date(scheduledForValue);
              if (!isNaN(scheduledTime.getTime())) {
                return Math.floor(scheduledTime.getTime() / 1000);
              }
            }
          }
        }
        return undefined;
      }

      const scheduledTimestamp =
        actionType === "schedule" && scheduledFor
          ? await parseScheduledTimestamp(scheduledFor)
          : undefined;

      // Get effective hashtags - prioritize manual selection over queue defaults
      let effectiveHashtags = "";

      if (useHashtagPresets) {
        // Manual hashtag presets are enabled
        if (selectedHashtags) {
          // Use manually selected hashtag preset
          effectiveHashtags = selectedHashtags;
        }
        // If useHashtagPresets is true but no manual preset selected, use no hashtags
      } else {
        // Manual hashtag presets are disabled, use displayed hashtags (queue defaults)
        effectiveHashtags = displayedHashtags ?? "";
      }

      const hashtagsFromQueue = effectiveHashtags
        ? effectiveHashtags
            .split(" ")
            .map((tag) => tag.replace("#", "").trim())
            .filter(Boolean)
        : [];
      const customTagsList = customTags
        ? customTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];
      // Combine and deduplicate tags (case insensitive)
      const allTags = [...hashtagsFromQueue, ...customTagsList];
      const uniqueTags = allTags.filter(
        (tag, index) =>
          allTags.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) ===
          index
      );

      const eventData = {
        title,
        content: markdownContent,
        summary: finalSummary,
        image,
        tags: uniqueTags,
        identifier,
        publishedAt:
          actionType === "publish" ? nowSeconds() : scheduledTimestamp,
      };

      const { nostrEvent, signedEvent } =
        await nostrAdapter.signLongFormEvent(eventData);

      const form = document.createElement("form");
      form.method = "POST";
      form.style.display = "none";

      const fields: Array<[string, string]> = [
        [
          "_action",
          actionType === "schedule" ? "schedule-longform" : "publish",
        ],
        ["title", title],
        ["content", content],
        ["summary", finalSummary],
        ["image", image],
        ["tags", uniqueTags.join(",")],
        ["queueType", selectedQueueType],
        [
          "scheduledFor",
          scheduledTimestamp ? scheduledTimestamp.toString() : "",
        ],
        ["signedEvent", JSON.stringify(signedEvent)],
        ["nostrEvent", JSON.stringify(nostrEvent)],
      ];

      fields.forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value || "";
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "LongFormPost",
          action: "handleSubmit",
        },
        false
      ); // Don't show toast, let component handle it
    }
  };

  return { handleSchedule };
}
