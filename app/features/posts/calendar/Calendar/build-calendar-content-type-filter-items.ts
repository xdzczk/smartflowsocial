import type { PublishingContentTypeFilterItem } from "~/features/posts/components/publishing-suite";

function withTab(basePath: string, searchParams: URLSearchParams, tab: string) {
  const next = new URLSearchParams(searchParams);
  next.set("tab", tab);
  return `${basePath}?${next.toString()}`;
}

export function buildCalendarContentTypeFilterItems({
  basePath,
  searchParams,
  totals,
}: {
  basePath: string;
  searchParams: URLSearchParams;
  totals: {
    all: number;
    posts: number;
    reposts: number;
    followups: number;
    longform: number;
  };
}): PublishingContentTypeFilterItem[] {
  return [
    {
      id: "all",
      to: withTab(basePath, searchParams, "all"),
      triggerLabel: "All types",
      menuLabel: `All types (${totals.all})`,
      ariaLabel: "All content types",
    },
    {
      id: "posts",
      to: withTab(basePath, searchParams, "posts"),
      triggerLabel: "Posts",
      menuLabel: `Posts (${totals.posts})`,
      ariaLabel: "Posts",
    },
    {
      id: "reposts",
      to: withTab(basePath, searchParams, "reposts"),
      triggerLabel: "Reposts",
      menuLabel: `Reposts (${totals.reposts})`,
      ariaLabel: "Reposts",
    },
    {
      id: "followups",
      to: withTab(basePath, searchParams, "followups"),
      triggerLabel: "Follow-ups",
      menuLabel: `Follow-ups (${totals.followups})`,
      ariaLabel: "Follow-ups",
    },
    {
      id: "longform",
      to: withTab(basePath, searchParams, "longform"),
      triggerLabel: "Articles",
      menuLabel: `Articles (${totals.longform})`,
      ariaLabel: "Articles",
    },
  ];
}
