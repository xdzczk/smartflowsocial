/**
 * Query key factory for published posts.
 * Extracted into its own file to prevent circular dependencies:
 * usePublishedPostsQuery.ts imports useRefreshPostViews.ts (for invalidateDependentCaches),
 * which must also import these keys — keeping them here breaks that cycle.
 */
export const publishedPostsKeys = {
  all: ["published-posts"] as const,
  lists: () => [...publishedPostsKeys.all, "list"] as const,
  list: (
    queueType?: string,
    tab?: string,
    page?: number,
    dateFrom?: string,
    dateTo?: string
  ) =>
    [
      ...publishedPostsKeys.lists(),
      queueType,
      tab,
      page ?? "",
      dateFrom ?? "",
      dateTo ?? "",
    ] as const,
  detail: (id: string) => [...publishedPostsKeys.all, "detail", id] as const,
};
