import type { PublishingContentTypeFilterItem } from "./PublishingContentTypeFilter";

function menuWithCount(label: string, count: number): string {
  return `${label} (${count})`;
}

/**
 * Options for Scheduled / Published content-type filter (matches existing tab routing).
 */
export function buildLibraryContentTypeFilterItems({
  basePath,
  queuePathSegment,
  searchParams,
  totalContentCount,
  totalPostsCount,
  totalRepostsCount,
  totalFollowUpsCount,
  totalLongformCount,
}: {
  basePath: string;
  queuePathSegment: string;
  searchParams: URLSearchParams;
  totalContentCount: number;
  totalPostsCount: number;
  totalRepostsCount: number;
  totalFollowUpsCount: number;
  totalLongformCount: number;
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
      ariaLabel: `All scheduled content, ${totalContentCount} items`,
    },
    {
      id: "posts",
      to: withTab("posts"),
      triggerLabel: "Post",
      menuLabel: menuWithCount("Post", totalPostsCount),
      ariaLabel: `Posts, ${totalPostsCount} items`,
    },
    {
      id: "longform",
      to: withTab("longform"),
      triggerLabel: "Article",
      menuLabel: menuWithCount("Article", totalLongformCount),
      ariaLabel: `Articles, ${totalLongformCount} items`,
    },
    {
      id: "reposts",
      to: withTab("reposts"),
      triggerLabel: "Repost",
      menuLabel: menuWithCount("Repost", totalRepostsCount),
      ariaLabel: `Reposts, ${totalRepostsCount} items`,
    },
    {
      id: "followups",
      to: withTab("followups"),
      triggerLabel: "Follow-up",
      menuLabel: menuWithCount("Follow-up", totalFollowUpsCount),
      ariaLabel: `Follow-ups, ${totalFollowUpsCount} items`,
    },
  ];
}
