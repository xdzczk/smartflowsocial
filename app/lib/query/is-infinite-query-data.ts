import type { QueryClient } from "@tanstack/react-query";

/**
 * Returns true when `data` has the shape of a TanStack Query infinite query
 * result (`{ pages: unknown[] }`).  Used to build predicates that skip active
 * infinite queries during bulk `invalidateQueries` / `refetchQueries` calls so
 * we don't accidentally restart page-1 refetches that collapse the accumulated
 * scroll state.
 */
export function isInfiniteQueryData(data: unknown): boolean {
  return (
    data != null &&
    typeof data === "object" &&
    "pages" in data &&
    Array.isArray((data as { pages?: unknown }).pages)
  );
}

/**
 * Predicate that *excludes* active infinite queries from
 * `queryClient.invalidateQueries()` / `refetchQueries()`.
 *
 * Usage:
 * ```ts
 * queryClient.invalidateQueries({
 *   queryKey: someKey,
 *   predicate: skipInfiniteQueries,
 * });
 * ```
 */
export function skipInfiniteQueries(query: {
  state: { data: unknown };
}): boolean {
  return !isInfiniteQueryData(query.state.data);
}

/**
 * Remove **inactive** infinite queries from the cache for the given keys.
 *
 * Active queries (currently rendered) are left alone so on-page optimistic
 * updates and scroll position are preserved.  Inactive ones are evicted so
 * the next navigation starts fresh from the loader's `initialData`.
 */
export function removeStaleInfiniteQueries(
  queryClient: QueryClient,
  queryKeys: ReadonlyArray<readonly unknown[]>
): void {
  for (const queryKey of queryKeys) {
    queryClient.removeQueries({
      queryKey,
      type: "inactive",
      predicate: (query) => isInfiniteQueryData(query.state.data),
    });
  }
}
