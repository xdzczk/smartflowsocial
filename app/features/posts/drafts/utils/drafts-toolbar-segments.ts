import type { PublishingContentTypeFilterItem } from "~/features/posts/components/publishing-suite/PublishingContentTypeFilter";

function menuWithCount(label: string, count: number): string {
  return `${label} (${count})`;
}

export function buildDraftsContentTypeFilterItems({
  basePath,
  queuePathSegment,
  searchParams,
  totalContentCount,
  totalPostsCount,
  totalPollsCount,
  totalThreadsCount,
  totalRepostsCount,
  totalFollowUpsCount,
  totalLongformCount,
  bulkCount,
}: {
  basePath: string;
  queuePathSegment: string;
  searchParams: URLSearchParams;
  totalContentCount: number;
  totalPostsCount: number;
  totalPollsCount: number;
  totalThreadsCount: number;
  totalRepostsCount: number;
  totalFollowUpsCount: number;
  totalLongformCount: number;
  bulkCount: number;
}): PublishingContentTypeFilterItem[] {
  const withTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    return `${basePath}${queuePathSegment}?${next.toString()}`;
  };

  return [
    {
      id: "all",
      to: withTab("all"),
      triggerLabel: "All types",
      menuLabel: menuWithCount("All types", totalContentCount),
      ariaLabel: `All drafts, ${totalContentCount} items`,
    },
    {
      id: "posts",
      to: withTab("posts"),
      triggerLabel: "Post",
      menuLabel: menuWithCount("Post", totalPostsCount),
      ariaLabel: `Post drafts, ${totalPostsCount} items`,
    },
    {
      id: "polls",
      to: withTab("polls"),
      triggerLabel: "Poll",
      menuLabel: menuWithCount("Poll", totalPollsCount),
      ariaLabel: `Poll drafts, ${totalPollsCount} items`,
    },
    {
      id: "threads",
      to: withTab("threads"),
      triggerLabel: "Thread",
      menuLabel: menuWithCount("Thread", totalThreadsCount),
      ariaLabel: `Thread drafts, ${totalThreadsCount} items`,
    },
    {
      id: "longform",
      to: withTab("longform"),
      triggerLabel: "Article",
      menuLabel: menuWithCount("Article", totalLongformCount),
      ariaLabel: `Article drafts, ${totalLongformCount} items`,
    },
    {
      id: "reposts",
      to: withTab("reposts"),
      triggerLabel: "Repost",
      menuLabel: menuWithCount("Repost", totalRepostsCount),
      ariaLabel: `Repost drafts, ${totalRepostsCount} items`,
    },
    {
      id: "followups",
      to: withTab("followups"),
      triggerLabel: "Follow-up",
      menuLabel: menuWithCount("Follow-up", totalFollowUpsCount),
      ariaLabel: `Follow-up drafts, ${totalFollowUpsCount} items`,
    },
    {
      id: "bulk",
      to: withTab("bulk"),
      triggerLabel: "Bulk",
      menuLabel: menuWithCount("Bulk", bulkCount),
      ariaLabel: `Bulk drafts, ${bulkCount} items`,
    },
  ];
}
