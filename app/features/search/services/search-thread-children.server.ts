/**
 * Lazy-load direct replies under any note in a thread (used when user expands nested replies).
 */

import { connectToPrimalCache } from "~/features/cache/primalCache.server";

import { fetchAuthorsInfoBatch } from "./search-authors-batch.server";
import { mapLooseNostrEventsToSearchReplyItems } from "./search-reply-items.server";
import type { SearchReplyItemDTO } from "./search-reply-items.server";
import {
  SEARCH_THREAD_BRANCH_REPLIES_MAX,
  collectCandidatesFromPrimalResponses,
  extractDirectRepliesToParent,
} from "./search-thread-replies.server";

const HEX64 = /^[a-f0-9]{64}$/i;

export async function loadSearchThreadChildReplies(
  parentEventId: string
): Promise<{ replies: SearchReplyItemDTO[] }> {
  const trimmed = parentEventId.trim().toLowerCase();
  if (!HEX64.test(trimmed)) {
    return { replies: [] };
  }

  const threadResponses = await connectToPrimalCache("thread_view", {
    event_id: trimmed,
  });
  const candidates = collectCandidatesFromPrimalResponses(threadResponses);
  const raw = extractDirectRepliesToParent(candidates, trimmed, {
    max: SEARCH_THREAD_BRANCH_REPLIES_MAX,
  });
  const pubkeys = [
    ...new Set(
      raw
        .map((e) => (typeof e.pubkey === "string" ? e.pubkey : ""))
        .filter(Boolean)
    ),
  ];
  const authorsMap = await fetchAuthorsInfoBatch(pubkeys);
  return {
    replies: mapLooseNostrEventsToSearchReplyItems(raw, authorsMap),
  };
}
