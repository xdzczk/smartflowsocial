import { describe, expect, it } from "vitest";

import { selectExactOldestPrefix } from "~/features/referral/referral-payout-selection";

describe("selectExactOldestPrefix", () => {
  const rows = [
    { id: "a", commissionSats: 3000 },
    { id: "b", commissionSats: 2000 },
  ];

  it("selects a prefix that sums exactly to the amount", () => {
    expect(selectExactOldestPrefix(rows, 3000)).toEqual(["a"]);
    expect(selectExactOldestPrefix(rows, 5000)).toEqual(["a", "b"]);
  });

  it("refuses an amount that would split or over-mark an earning", () => {
    expect(selectExactOldestPrefix(rows, 1)).toBeNull();
    expect(selectExactOldestPrefix(rows, 4000)).toBeNull();
    expect(selectExactOldestPrefix(rows, 0)).toBeNull();
  });
});
