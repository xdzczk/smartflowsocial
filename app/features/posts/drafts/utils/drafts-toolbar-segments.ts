import type { PublishingSegmentLinkItem } from "~/features/posts/ui";

export function buildDraftsSegmentLinkItems({
  basePath,
  queuePathSegment,
  searchParams,
  totalContentCount,
  totalPostsCount,
  totalPollsCount,
  totalThreadsCount,
  totalRepostsCount,
  totalLongformCount,
  bulkCount,
}: {
  basePath: string;
  /** `/${queueType}` when queue is in the path, else `""`. */
  queuePathSegment: string;
  searchParams: URLSearchParams;
  totalContentCount: number;
  totalPostsCount: number;
  totalPollsCount: number;
  totalThreadsCount: number;
  totalRepostsCount: number;
  totalLongformCount: number;
  bulkCount: number;
}): PublishingSegmentLinkItem[] {
  const withTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    return `${basePath}${queuePathSegment}?${next.toString()}`;
  };

  return [
    {
      id: "all",
      label: `All (${totalContentCount})`,
      to: withTab("all"),
      ariaLabel: `All drafts, ${totalContentCount} items`,
    },
    {
      id: "posts",
      label: `Posts (${totalPostsCount})`,
      to: withTab("posts"),
      ariaLabel: `Post drafts, ${totalPostsCount} items`,
    },
    {
      id: "polls",
      label: `Polls (${totalPollsCount})`,
      to: withTab("polls"),
      ariaLabel: `Poll drafts, ${totalPollsCount} items`,
    },
    {
      id: "threads",
      label: `Threads (${totalThreadsCount})`,
      to: withTab("threads"),
      ariaLabel: `Thread drafts, ${totalThreadsCount} items`,
    },
    {
      id: "longform",
      label: `Articles (${totalLongformCount})`,
      to: withTab("longform"),
      ariaLabel: `Article drafts, ${totalLongformCount} items`,
    },
    {
      id: "reposts",
      label: `Reposts (${totalRepostsCount})`,
      to: withTab("reposts"),
      ariaLabel: `Repost drafts, ${totalRepostsCount} items`,
    },
    {
      id: "bulk",
      label: `Bulk (${bulkCount})`,
      to: withTab("bulk"),
      ariaLabel: `Bulk drafts, ${bulkCount} items`,
    },
  ];
}
