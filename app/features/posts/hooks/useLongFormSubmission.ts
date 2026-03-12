/**
 * Hook for handling longform post submission logic
 * Extracts the complex submission logic from LongFormPost component
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { tryBackgroundReconnect } from "~/features/auth/signer";
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
  getMinScheduleTimestampMs,
  nowSeconds,
  parseDateTimeLocal,
  toUnixTimestamp,
} from "~/lib/temporal";

/**
 * Parse scheduled timestamp with fallbacks
 */
async function parseScheduledTimestamp(
  scheduledForValue: string
): Promise<number | undefined> {
  try {
    const zoned = parseDateTimeLocal(scheduledForValue, "UTC");
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

function getEffectiveHashtagsAndUniqueTags(
  useHashtagPresets: boolean,
  selectedHashtags: string,
  displayedHashtags: string | null,
  customTags: string
): string[] {
  const effectiveHashtags = useHashtagPresets
    ? selectedHashtags
    : (displayedHashtags ?? "");
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
  const allTags = [...hashtagsFromQueue, ...customTagsList];
  return allTags.filter(
    (tag, index) =>
      allTags.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) === index
  );
}

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
  userTimezone?: string;
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
  userTimezone = "UTC",
}: UseLongFormSubmissionProps) {
  const [isSigning, setIsSigning] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const lastScheduleActionRef = useRef<"schedule" | "publish" | null>(null);
  const handleScheduleRef =
    useRef<(actionType: "schedule" | "publish") => Promise<void>>(null);

  // After successful remote signer reconnect, clear stuck signing state and retry in-flight sign.
  const retryLastSchedule = useCallback(() => {
    const action = lastScheduleActionRef.current;
    lastScheduleActionRef.current = null;
    if (action) void handleScheduleRef.current?.(action);
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsSigning(false);
      setSigningError(null);
      retryLastSchedule();
    };
    window.addEventListener("nostr-connection-healthy", handler);
    return () =>
      window.removeEventListener("nostr-connection-healthy", handler);
  }, [retryLastSchedule]);

  // When awaiting signer approval, try background reconnect periodically.
  useEffect(() => {
    if (!isSigning) return;
    let attempts = 0;
    const interval = setInterval(() => {
      void tryBackgroundReconnect();
      attempts++;
      if (attempts >= 5) clearInterval(interval);
    }, 10_000);
    return () => clearInterval(interval);
  }, [isSigning]);

  const handleSchedule = async (actionType: "schedule" | "publish") => {
    if (!title.trim() || !content.trim()) {
      return;
    }

    try {
      setSigningError(null);
      const markdownContent = content;
      const finalSummary = summary || generateSummaryFromMarkdown(content);
      const identifier = generateArticleIdentifier(title);

      const scheduledTimestamp =
        actionType === "schedule" && scheduledFor
          ? await parseScheduledTimestamp(scheduledFor)
          : undefined;

      if (
        actionType === "schedule" &&
        scheduledTimestamp !== undefined &&
        scheduledTimestamp * 1000 < getMinScheduleTimestampMs(userTimezone)
      ) {
        setSigningError("Schedule time must be in the future.");
        return;
      }

      const uniqueTags = getEffectiveHashtagsAndUniqueTags(
        useHashtagPresets,
        selectedHashtags,
        displayedHashtags,
        customTags
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

      lastScheduleActionRef.current = actionType;
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
      lastScheduleActionRef.current = null;
      setIsSigning(false);
    }
  };

  useEffect(() => {
    handleScheduleRef.current = handleSchedule;
  });

  const cancelSigning = () => {
    lastScheduleActionRef.current = null;
    setIsSigning(false);
    setSigningError(null);
    void tryBackgroundReconnect();
  };

  return { handleSchedule, isSigning, signingError, cancelSigning };
}
