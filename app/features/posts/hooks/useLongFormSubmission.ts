/**
 * Hook for handling longform post submission logic
 * Extracts the complex submission logic from LongFormPost component
 */

import { useState } from "react";

import { cancelSignerInFlight } from "~/features/auth/signer";
import { pendingPublish } from "~/features/auth/signing/signing-attempts.client";
import type { ComposerPublishMode } from "~/features/posts/composer/components/composer/publish-mode";
import {
  appendRelayOverride,
  appendSubmissionId,
} from "~/features/posts/composer/services/build-publish-formdata.client";
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

interface LongformQuoteScheduleRow {
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

async function resolveEffectiveScheduledForLongform(params: {
  actionType: "schedule" | "publish";
  publishMode: ComposerPublishMode;
  selectedQueueType: string;
  scheduledFor: string | null;
  calculateQueueScheduleTime?: (
    queueTypeName: string
  ) => Promise<string | null>;
}): Promise<string | null> {
  const {
    actionType,
    publishMode,
    selectedQueueType,
    scheduledFor,
    calculateQueueScheduleTime,
  } = params;
  let effective = scheduledFor;
  if (
    actionType === "schedule" &&
    publishMode === "queue" &&
    selectedQueueType !== "unassigned" &&
    selectedQueueType !== "Unassigned" &&
    !effective &&
    calculateQueueScheduleTime
  ) {
    const computed = await calculateQueueScheduleTime(selectedQueueType);
    if (computed) effective = computed;
  }
  return effective;
}

async function buildSignedLongformQuoteSchedules(
  alsoScheduleQuote: boolean,
  quoteEntries: LongformQuoteEntry[],
  uniqueTags: string[],
  mainScheduledUnix: number,
  signedMain: Parameters<typeof buildLongformQuoteEvent>[0]
): Promise<
  | { ok: true; schedules: LongformQuoteScheduleRow[] }
  | { ok: false; error: string }
> {
  const quoteSchedules: LongformQuoteScheduleRow[] = [];
  if (!alsoScheduleQuote || quoteEntries.length === 0) {
    return { ok: true, schedules: quoteSchedules };
  }
  const tagArray = uniqueTags.length ? [["t", ...uniqueTags.slice(0, 5)]] : [];
  for (const entry of quoteEntries) {
    const delay = { value: entry.value, unit: entry.unit };
    if (!isValidDelayAfterMain(delay)) {
      return {
        ok: false,
        error:
          "Each quote must be at least 1 (hour or minute) after the main post.",
      };
    }
    const offsetSeconds = delayAfterMainToSeconds(delay);
    const quoteScheduledUnix = mainScheduledUnix + offsetSeconds;
    if (quoteScheduledUnix <= mainScheduledUnix) {
      return {
        ok: false,
        error: "Quote must be scheduled after the main post.",
      };
    }
    const quoteEvent = buildLongformQuoteEvent(
      signedMain,
      entry.caption,
      quoteScheduledUnix,
      tagArray
    );
    const { signedEvent: quoteSignedEvent } = await nostrAdapter.signEvent(
      {
        content: quoteEvent.content,
        created_at: quoteEvent.created_at,
        kind: quoteEvent.kind,
        tags: quoteEvent.tags,
      },
      { clearCacheOnError: false }
    );
    quoteSchedules.push({
      scheduledFor: quoteScheduledUnix,
      signedEvent: quoteSignedEvent,
      caption: entry.caption || undefined,
    });
  }
  return { ok: true, schedules: quoteSchedules };
}

function submitDocumentPostForm(fields: Array<[string, string]>): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.style.display = "none";
  fields.forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value || "";
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
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
  publishMode?: ComposerPublishMode;
  calculateQueueScheduleTime?: (
    queueTypeName: string
  ) => Promise<string | null>;
  /** When set (user picked relays in composer), sent as `relays` JSON on submit. */
  relayOverride?: string[] | null;
  includeHashtagsInNoteBody: boolean;
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
  publishMode = "now",
  calculateQueueScheduleTime,
  relayOverride = null,
  includeHashtagsInNoteBody,
}: UseLongFormSubmissionProps) {
  const [isSigning, setIsSigning] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);

  /**
   * Long-form publish/schedule click. Routes through the pending-publish
   * state machine so an interrupted bunker sign autocompletes when the
   * remote signer comes back (within the 5-minute recovery window) and
   * uses the same client-generated submissionId across the original and
   * resumed attempts. That submissionId becomes the server-side
   * creationIdempotencyKey, collapsing both attempts onto a single Post
   * row instead of double-publishing or content-hash colliding with a
   * prior cold-restart attempt.
   */
  const handleSchedule = async (actionType: "schedule" | "publish") => {
    if (!title.trim() || !content.trim()) {
      return;
    }

    const isAttemptStale = (attemptId: string): boolean =>
      pendingPublish.getSnapshot()?.id !== attemptId;

    const performSignAndSubmit = async (
      submissionId: string
    ): Promise<void> => {
      try {
        setSigningError(null);
        const markdownContent = content;
        const finalSummary = summary || generateSummaryFromMarkdown(content);
        const identifier = generateArticleIdentifier(title);

        const effectiveScheduled = await resolveEffectiveScheduledForLongform({
          actionType,
          publishMode,
          selectedQueueType,
          scheduledFor,
          calculateQueueScheduleTime,
        });

        const scheduledTimestamp =
          actionType === "schedule" && effectiveScheduled
            ? await parseScheduledTimestamp(effectiveScheduled)
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

        setIsSigning(true);
        const { nostrEvent, signedEvent } =
          await nostrAdapter.signLongFormEvent(eventData, {
            clearCacheOnError: false,
          });

        // Cancellation guard: if the user discarded this attempt or a
        // fresher click overrode it while the bunker was busy, bail out
        // before we mutate UI state or build the submission form.
        if (isAttemptStale(submissionId)) {
          return;
        }

        const mainScheduledUnix =
          actionType === "publish"
            ? nowSeconds()
            : (scheduledTimestamp ?? nowSeconds());

        const quoteResult = await buildSignedLongformQuoteSchedules(
          alsoScheduleQuote,
          quoteEntries,
          uniqueTags,
          mainScheduledUnix,
          signedEvent
        );
        if (!quoteResult.ok) {
          setSigningError(quoteResult.error);
          return;
        }
        const quoteSchedules = quoteResult.schedules;

        if (isAttemptStale(submissionId)) {
          return;
        }

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
          ["includeHashtagsInNoteBody", String(includeHashtagsInNoteBody)],
        ];

        if (quoteSchedules.length > 0) {
          fields.push(["quoteSchedules", JSON.stringify(quoteSchedules)]);
          fields.push(["alsoScheduleQuote", "on"]);
        }

        // Funnel through the shared helpers (Record adapter) so the
        // encoding and "non-empty" guard match every other publish
        // surface — and so resumed attempts ship the *same*
        // submissionId the store handed us.
        const sidecar: Record<string, string> = {};
        appendRelayOverride(sidecar, relayOverride);
        appendSubmissionId(sidecar, submissionId);
        for (const [key, value] of Object.entries(sidecar)) {
          fields.push([key, value]);
        }

        submitDocumentPostForm(fields);
      } catch (error) {
        if (isAttemptStale(submissionId)) {
          // Stale attempts must not surface their late errors as a UI
          // banner — the user already moved on.
          return;
        }
        const { handleAsyncError } = await import("~/lib/error-handler.client");
        handleAsyncError(
          error,
          { component: "LongFormPost", action: "handleSubmit" },
          false
        );
        setSigningError(
          error instanceof Error
            ? error.message
            : "Failed to sign article. Please try again."
        );
        // Re-throw so the pending-publish state machine can classify
        // signer-unavailable (resumable) vs terminal failure.
        throw error;
      } finally {
        if (!isAttemptStale(submissionId)) {
          setIsSigning(false);
        }
      }
    };

    pendingPublish.start({ performSignAndSubmit });
  };

  const cancelSigning = () => {
    pendingPublish.cancel();
    setIsSigning(false);
    setSigningError(null);
    cancelSignerInFlight();
  };

  return { handleSchedule, isSigning, signingError, cancelSigning };
}
