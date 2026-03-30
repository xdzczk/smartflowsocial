import {
  appendDraftListSearchExtras,
  buildShortDraftSearchHaystack,
  matchesDraftSearch,
} from "~/features/posts/drafts/utils/draft-search-haystack";
import { getContentTypeBadge } from "~/features/posts/utils/content-helpers";

import type { CombinedContent } from "../types";

export function combinedContentMatchesSearch(
  item: CombinedContent,
  type: "scheduled" | "draft" | "published",
  searchTerm: string
): boolean {
  if (type === "draft" && item.type === "post") {
    const od = item.originalData as {
      caption?: string | null;
      content?: string | null;
      draftMeta?: unknown;
    };
    const haystack = appendDraftListSearchExtras(
      buildShortDraftSearchHaystack(od),
      item.queueType?.name,
      getContentTypeBadge(item).text
    );
    return matchesDraftSearch(haystack, searchTerm);
  }
  if (type === "draft" && item.type === "longform") {
    const od = item.originalData as {
      title?: string | null;
      summary?: string | null;
      content?: string | null;
    };
    const base = `${(od.title ?? "").toLowerCase()} ${(od.summary ?? "").toLowerCase()} ${(od.content ?? "").toLowerCase()}`;
    const haystack = appendDraftListSearchExtras(
      base,
      item.queueType?.name,
      getContentTypeBadge(item).text
    );
    return matchesDraftSearch(haystack, searchTerm);
  }
  return Boolean(
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for filter logic
    item.caption?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for filter logic
    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for filter logic
    item.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.summary?.toLowerCase().includes(searchTerm.toLowerCase())
  );
}

export function getContentScrollElement(
  useDedicatedScroll: boolean,
  scrollRef: { current: HTMLDivElement | null }
): Element | null {
  if (useDedicatedScroll && scrollRef.current) return scrollRef.current;
  return typeof document !== "undefined" ? document.documentElement : null;
}
