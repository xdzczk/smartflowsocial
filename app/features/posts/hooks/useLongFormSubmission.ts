/**
 * Hook for handling longform post submission logic
 * Extracts the complex submission logic from LongFormPost component
 */

import {
  convertEditorJSToMarkdown,
  generateArticleIdentifier,
} from "~/features/posts/utils/editorjs-conversion";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

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

      let scheduledTimestamp: number | undefined;
      if (actionType === "schedule" && scheduledFor) {
        const scheduledTime = new Date(scheduledFor);
        if (!isNaN(scheduledTime.getTime())) {
          scheduledTimestamp = Math.floor(scheduledTime.getTime() / 1000);
        }
      }

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
          actionType === "publish"
            ? Math.floor(Date.now() / 1000)
            : scheduledTimestamp,
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
