import { describe, expect, it } from "vitest";

import {
  canSubmitAutoRenewCheckout,
  isLikelyNwcConnectionString,
} from "~/features/payments/checkout/nwc-string-guard";

describe("isLikelyNwcConnectionString", () => {
  it("accepts nostr+walletconnect URL", () => {
    expect(
      isLikelyNwcConnectionString(
        "nostr+walletconnect://relay.example/nwc?token=abc"
      )
    ).toBe(true);
  });

  it("rejects short strings", () => {
    expect(isLikelyNwcConnectionString("short")).toBe(false);
  });
});

describe("canSubmitAutoRenewCheckout", () => {
  it("allows when NWC enabled without paste", () => {
    expect(
      canSubmitAutoRenewCheckout({ nwcEnabled: true, nwcString: "" })
    ).toBe(true);
  });

  it("requires valid string when NWC not enabled", () => {
    expect(
      canSubmitAutoRenewCheckout({ nwcEnabled: false, nwcString: "" })
    ).toBe(false);
    expect(
      canSubmitAutoRenewCheckout({
        nwcEnabled: false,
        nwcString: "nostr+walletconnect://x",
      })
    ).toBe(true);
  });
});
