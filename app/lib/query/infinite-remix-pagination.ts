/**
 * Derives the next infinite-query page param from loader pagination totals.
 *
 * Prefer this over `lastPage.pagination.currentPage + 1`: some responses can
 * echo an incorrect `currentPage`, which makes `getNextPageParam` keep
 * returning the same page number (e.g. always page 2) and hammer the server.
 *
 * `allPages.length` matches how many pages TanStack has accumulated; the next
 * fetch should request page `allPages.length + 1` when more server pages exist.
 *
 * When the response contains both `pagination` (short posts) and
 * `longformPagination` (articles), we take the *maximum* of the two page
 * counts so that all items are eventually fetched.
 */
export interface LoaderPaginationShape {
  pagination?: { pages?: number };
  longformPagination?: { pages?: number };
  [key: string]: unknown;
}

function extractPages(p: { pages?: number } | undefined): number {
  if (!p || typeof p.pages !== "number" || !Number.isFinite(p.pages)) return 0;
  return Math.max(0, p.pages);
}

export function getNextPageParamFromPaginationTotals(
  lastPage: LoaderPaginationShape,
  allPages: LoaderPaginationShape[]
): number | undefined {
  const postPages = extractPages(lastPage.pagination);
  const longformPages = extractPages(lastPage.longformPagination);
  const totalPages = Math.max(postPages, longformPages);
  if (totalPages < 1) return undefined;
  if (allPages.length >= totalPages) return undefined;
  return allPages.length + 1;
}
