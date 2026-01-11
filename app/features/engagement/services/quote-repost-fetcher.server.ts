/**
 * Quote repost fetching service
 * Fetches and processes quote reposts from Primal API
 */

import { connectToPrimalCache } from "~/features/cache/primalCache.server";

import { processQuoteReposts } from "../engagement.server";
import type {
  Notification,
  NotificationEvent,
  NostrTag,
  PrimalEvent,
} from "../types";

/**
 * Extract quote reposts from Primal notifications data
 */
export function extractQuoteReposts(
  notificationsData: unknown[],
  userNpub: string
): NotificationEvent[] {
  if (!Array.isArray(notificationsData)) {
    return [];
  }

  return (notificationsData as PrimalEvent[])
    .filter((item: PrimalEvent) => {
      if (
        Array.isArray(item) &&
        item[0] === "EVENT" &&
        typeof item[2] === "object" &&
        !Array.isArray(item[2]) &&
        "kind" in item[2] &&
        (item[2] as { kind?: unknown }).kind === 1
      ) {
        const event = item[2] as {
          id?: unknown;
          pubkey?: unknown;
          content?: unknown;
          kind?: unknown;
          tags?: unknown;
        };

        if (typeof event !== "object" || Array.isArray(event)) {
          return false;
        }

        const eventTyped = event;
        if (
          !eventTyped.id ||
          typeof eventTyped.id !== "string" ||
          !eventTyped.pubkey ||
          typeof eventTyped.pubkey !== "string" ||
          typeof eventTyped.content !== "string"
        ) {
          return false;
        }

        const tags = (eventTyped as { tags: NostrTag[] }).tags;

        // Skip if it's the user's own post
        if (eventTyped.pubkey === userNpub) {
          return false;
        }

        // Check if it has both "e" and "p" tags with mention marker
        const eMentionTags = tags.filter(
          (tag: NostrTag) => tag[0] === "e" && tag[3] === "mention"
        );
        const hasEMention = eMentionTags.length > 0;

        const pMentionTags = tags.filter(
          (tag: NostrTag) =>
            tag[0] === "p" && (tag[3] === "mention" || tag[3] === "")
        );
        const hasPMention = pMentionTags.length > 0;

        if (!hasEMention || !hasPMention) {
          return false;
        }

        // Check if the mentioned user (p tag) is the current user
        const mentionedUserPubkey = tags.find(
          (tag: NostrTag) =>
            tag[0] === "p" && (tag[3] === "mention" || tag[3] === "")
        )?.[1];
        return mentionedUserPubkey === userNpub;
      }
      return false;
    })
    .map((item: PrimalEvent) => {
      if (Array.isArray(item)) {
        return item[2] as NotificationEvent;
      }
      throw new Error("Invalid PrimalEvent structure");
    });
}

/**
 * Fetch and process quote reposts
 */
export async function fetchQuoteReposts(
  userNpub: string,
  limit = 100
): Promise<Notification[]> {
  try {
    const notificationsData = await connectToPrimalCache("get_notifications", {
      pubkey: userNpub,
      limit,
    });

    const rawQuoteReposts = extractQuoteReposts(
      Array.isArray(notificationsData) ? notificationsData : [],
      userNpub
    );

    if (rawQuoteReposts.length === 0) {
      return [];
    }

    return await processQuoteReposts(rawQuoteReposts, connectToPrimalCache);
  } catch (error) {
    console.error(
      "🔍 [QUOTE REPOST DEBUG] Error fetching quote reposts:",
      error
    );
    return [];
  }
}
