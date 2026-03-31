/**
 * Derives the next infinite-query page param from loader pagination totals.
 *
 * Prefer this over `lastPage.pagination.currentPage + 1`: some responses can
 * echo an incorrect `currentPage`, which makes `getNextPageParam` keep
 * returning the same page number (e.g. always page 2) and hammer the server.
 *
 * `allPages.length` matches how many pages TanStack has accumulated; the next
 * fetch should request page `allPages.length + 1` when more server pages exist.
 */
export interface LoaderPaginationShape {
  pagination?: { pages?: number };
  [key: string]: unknown;
}

export function getNextPageParamFromPaginationTotals(
  lastPage: LoaderPaginationShape,
  allPages: LoaderPaginationShape[]
): number | undefined {
  const pagination = lastPage.pagination;
  if (
    !pagination ||
    typeof pagination.pages !== "number" ||
    !Number.isFinite(pagination.pages) ||
    pagination.pages < 1
  ) {
    return undefined;
  }
  const totalPages = pagination.pages;
  if (allPages.length >= totalPages) return undefined;
  return allPages.length + 1;
}
