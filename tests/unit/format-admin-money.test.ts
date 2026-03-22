import { describe, expect, it } from "vitest";

import { formatSatsForAdminUnit } from "~/features/admin/format-admin-money";

describe("formatSatsForAdminUnit", () => {
  const spot = { btcUsd: 100_000, btcEur: 90_000 };

  it("formats sats", () => {
    expect(formatSatsForAdminUnit(1_500_000, "SATS", null, "en-US")).toBe(
      "1,500,000"
    );
  });

  it("formats BTC with fractional sats trimmed", () => {
    expect(formatSatsForAdminUnit(100_000_000, "BTC", null, "en-US")).toBe(
      "1 BTC"
    );
    expect(formatSatsForAdminUnit(50_000_000, "BTC", null, "en-US")).toBe(
      "0.5 BTC"
    );
  });

  it("converts to USD with spot", () => {
    expect(formatSatsForAdminUnit(100_000_000, "USD", spot, "en-US")).toMatch(
      /100,000(\.00)?/
    );
  });

  it("converts to EUR with spot", () => {
    expect(formatSatsForAdminUnit(100_000_000, "EUR", spot, "de-DE")).toMatch(
      /90\.000/
    );
  });

  it("falls back to sats when fiat requested without spot", () => {
    expect(formatSatsForAdminUnit(100, "USD", null, "en-US")).toBe("100 sats");
  });
});
