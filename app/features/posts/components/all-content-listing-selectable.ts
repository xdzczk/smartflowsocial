/**
 * Select-all IDs for mixed Scheduled/Published "All" tabs (posts + articles).
 * Matches thread grouping + search behavior of {@link AllContentListing}.
 */

import type { CombinedContent } from "~/features/posts/types";
import {
  attachedCombinedByParentId,
  attachedCombinedForThreadRow,
} from "~/features/posts/utils/attached-follow-up-rows";
import {
  buildThreadListRows,
  threadListRowMatchesSearch,
} from "~/features/posts/utils/thread-list-grouping";

import { combinedContentMatchesSearch } from "./all-content-listing-utils";

/**
 * One id per visible row: thread root (earliest segment) or standalone post, plus every longform item.
 */
export function getSelectableRootIdsForMixedListing(
  content: CombinedContent[],
  listType: "scheduled" | "published",
  searchTerm: string
): string[] {
  const attachedByParentId = attachedCombinedByParentId(content);
  const sortedContent = [...content];
  const displayRows = buildThreadListRows(sortedContent, listType);
  const filteredRows = displayRows.filter((row) =>
    threadListRowMatchesSearch(
      row,
      listType,
      (item, t) => combinedContentMatchesSearch(item, t, searchTerm),
      attachedCombinedForThreadRow(attachedByParentId, row)
    )
  );
  return filteredRows.map((row) => row.root.id);
}
