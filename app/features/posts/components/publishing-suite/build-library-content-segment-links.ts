import type { PublishingSegmentLinkItem } from "./PublishingSegmentedControl";

/**
 * URL segments for Scheduled / Published (no polls, threads, or bulk tabs).
 */
export function buildLibraryContentSegmentLinkItems({
  basePath,
  queuePathSegment,
  searchParams,
  totalContentCount,
  totalPostsCount,
  totalRepostsCount,
  totalLongformCount,
}: {
  basePath: string;
  queuePathSegment: string;
  searchParams: URLSearchParams;
  totalContentCount: number;
  totalPostsCount: number;
  totalRepostsCount: number;
  totalLongformCount: number;
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
      ariaLabel: `All scheduled content, ${totalContentCount} items`,
    },
    {
      id: "posts",
      label: `Posts (${totalPostsCount})`,
      to: withTab("posts"),
      ariaLabel: `Posts, ${totalPostsCount} items`,
    },
    {
      id: "longform",
      label: `Articles (${totalLongformCount})`,
      to: withTab("longform"),
      ariaLabel: `Articles, ${totalLongformCount} items`,
    },
    {
      id: "reposts",
      label: `Reposts (${totalRepostsCount})`,
      to: withTab("reposts"),
      ariaLabel: `Reposts, ${totalRepostsCount} items`,
    },
  ];
}
