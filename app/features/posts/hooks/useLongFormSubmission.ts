/**
 * Hook for handling longform post submission logic
 * Extracts the complex submission logic from LongFormPost component
 */

import { useState } from "react";

import {
  delayAfterMainToSeconds,
  isValidDelayAfterMain,
} from "~/features/posts/utils/delay-after-main";
import type { DelayAfterMain } from "~/features/posts/utils/delay-after-main";
import { buildLongformQuoteEvent } from "~/features/posts/utils/repost-quote-events.client";
import {
  generateArticleIdentifier,
  generateSummaryFromMarkdown,
} from "~/lib/markdown-utils";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  fromDate,
  fromISOString,
  nowSeconds,
  parseDateTimeLocal,
  toUnixTimestamp,
} from "~/lib/temporal";

export interface LongformQuoteEntry {
  id: string;
  value: number;
  unit: DelayAfterMain["unit"];
  caption: string;
}

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
  alsoScheduleQuote?: boolean;
  quoteEntries?: LongformQuoteEntry[];
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
  alsoScheduleQuote = false,
  quoteEntries = [],
}: UseLongFormSubmissionProps) {
  const [isSigning, setIsSigning] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);

  const handleSchedule = async (actionType: "schedule" | "publish") => {
    if (!title.trim() || !content.trim()) {
      return;
    }

    try {
      setSigningError(null);
      const markdownContent = content;
      const finalSummary = summary || generateSummaryFromMarkdown(content);
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

      setIsSigning(true);
      const { nostrEvent, signedEvent } =
        await nostrAdapter.signLongFormEvent(eventData);

      const mainScheduledUnix =
        actionType === "publish"
          ? nowSeconds()
          : (scheduledTimestamp ?? nowSeconds());

      const quoteSchedules: Array<{
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
      }> = [];

      if (alsoScheduleQuote && quoteEntries.length > 0) {
        const tagArray = uniqueTags.length
          ? [["t", ...uniqueTags.slice(0, 5)]]
          : [];
        for (const entry of quoteEntries) {
          const delay = { value: entry.value, unit: entry.unit };
          if (!isValidDelayAfterMain(delay)) {
            setSigningError(
              "Each quote must be at least 1 (hour or minute) after the main post."
            );
            return;
          }
          const offsetSeconds = delayAfterMainToSeconds(delay);
          const quoteScheduledUnix = mainScheduledUnix + offsetSeconds;
          if (quoteScheduledUnix <= mainScheduledUnix) {
            setSigningError("Quote must be scheduled after the main post.");
            return;
          }
          const quoteEvent = buildLongformQuoteEvent(
            signedEvent,
            entry.caption,
            quoteScheduledUnix,
            tagArray
          );
          const { signedEvent: quoteSignedEvent } =
            await nostrAdapter.signEvent({
              content: quoteEvent.content,
              created_at: quoteEvent.created_at,
              kind: quoteEvent.kind,
              tags: quoteEvent.tags,
            });
          quoteSchedules.push({
            scheduledFor: quoteScheduledUnix,
            signedEvent: quoteSignedEvent,
            caption: entry.caption || undefined,
          });
        }
      }

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

      if (quoteSchedules.length > 0) {
        fields.push(["quoteSchedules", JSON.stringify(quoteSchedules)]);
        fields.push(["alsoScheduleQuote", "on"]);
      }

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
      setSigningError(
        error instanceof Error
          ? error.message
          : "Failed to sign article. Please try again."
      );
    } finally {
      setIsSigning(false);
    }
  };

  return { handleSchedule, isSigning, signingError };
}
