import type { PublishingContentTypeFilterItem } from "./PublishingContentTypeFilter";

export type DashboardFlowContentTab =
  | "all"
  | "posts"
  | "longform"
  | "reposts"
  | "followups"
  | "polls";

function withTab(basePath: string, searchParams: URLSearchParams, tab: string) {
  const next = new URLSearchParams(searchParams);
  next.set("tab", tab);
  return `${basePath}?${next.toString()}`;
}

/**
 * Dashboard flow type filter options.
 *
 * Note: Intentionally label-only (no counts) per Dashboard filter unification spec.
 */
export function buildDashboardContentTypeFilterItems({
  basePath,
  searchParams,
  nip88PollsEnabled,
}: {
  basePath: string;
  searchParams: URLSearchParams;
  nip88PollsEnabled: boolean;
}): PublishingContentTypeFilterItem[] {
  const items: PublishingContentTypeFilterItem[] = [
    {
      id: "all",
      to: withTab(basePath, searchParams, "all"),
      triggerLabel: "All types",
      menuLabel: "All types",
      ariaLabel: "All content types",
    },
    {
      id: "posts",
      to: withTab(basePath, searchParams, "posts"),
      triggerLabel: "Posts",
      menuLabel: "Posts",
      ariaLabel: "Posts",
    },
    {
      id: "longform",
      to: withTab(basePath, searchParams, "longform"),
      triggerLabel: "Articles",
      menuLabel: "Articles",
      ariaLabel: "Articles",
    },
    {
      id: "reposts",
      to: withTab(basePath, searchParams, "reposts"),
      triggerLabel: "Reposts",
      menuLabel: "Reposts",
      ariaLabel: "Reposts",
    },
    {
      id: "followups",
      to: withTab(basePath, searchParams, "followups"),
      triggerLabel: "Follow-ups",
      menuLabel: "Follow-ups",
      ariaLabel: "Queue follow-ups",
    },
  ];

  if (nip88PollsEnabled) {
    items.push({
      id: "polls",
      to: withTab(basePath, searchParams, "polls"),
      triggerLabel: "Polls",
      menuLabel: "Polls",
      ariaLabel: "Polls",
    });
  }

  return items;
}
