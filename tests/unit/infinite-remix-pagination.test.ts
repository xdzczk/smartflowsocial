import { describe, expect, it } from "vitest";

import { getNextPageParamFromPaginationTotals } from "~/lib/query/infinite-remix-pagination";

describe("getNextPageParamFromPaginationTotals", () => {
  it("returns next page index from loaded page count (not currentPage field)", () => {
    const page1 = { pagination: { pages: 5 } };
    expect(getNextPageParamFromPaginationTotals(page1, [page1])).toBe(2);

    const page2WrongCurrent = { pagination: { pages: 5, currentPage: 1 } };
    expect(
      getNextPageParamFromPaginationTotals(page2WrongCurrent, [
        page1,
        page2WrongCurrent,
      ])
    ).toBe(3);
  });

  it("returns undefined when all server pages are loaded", () => {
    const p = { pagination: { pages: 3 } };
    expect(getNextPageParamFromPaginationTotals(p, [p, p, p])).toBeUndefined();
  });
});
