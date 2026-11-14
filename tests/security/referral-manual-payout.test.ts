import { beforeEach, describe, expect, it, vi } from "vitest";

const pay = vi.hoisted(() =>
  vi.fn(
    async (_referrerNpub: string, _bolt11: string, _amountSats: number) => ({
      success: true,
    })
  )
);
const envState: { REFERRAL_MANUAL_PAYOUT_SECRET?: string } = {};

vi.mock("~/lib/env.server", () => ({
  get env() {
    return envState;
  },
}));

vi.mock("~/features/referral/referral-payout.server", () => ({
  payReferrerWithInvoice: (
    referrerNpub: string,
    bolt11: string,
    amountSats: number
  ) => pay(referrerNpub, bolt11, amountSats),
}));

const SECRET = "referral-payout-secret";

function post(body: unknown, secret?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (secret) headers.set("x-referral-payout-secret", secret);
  return new Request("http://localhost/api/referral/manual-payout", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("manual referral payout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.REFERRAL_MANUAL_PAYOUT_SECRET = undefined;
  });

  it("rejects the request when the secret is not configured", async () => {
    const { action } = await import("~/routes/api.referral.manual-payout");
    const response = await action({
      request: post({
        referrer_npub: "npub1example",
        bolt11: "lnbc1",
        amount_sats: 10,
      }),
      params: {},
      context: {},
    });
    expect(response.status).toBe(401);
    expect(pay).not.toHaveBeenCalled();
  });

  it("rejects an invalid secret", async () => {
    envState.REFERRAL_MANUAL_PAYOUT_SECRET = SECRET;
    const { action } = await import("~/routes/api.referral.manual-payout");
    const response = await action({
      request: post(
        {
          referrer_npub: "npub1example",
          bolt11: "lnbc1",
          amount_sats: 10,
        },
        "nope"
      ),
      params: {},
      context: {},
    });
    expect(response.status).toBe(401);
    expect(pay).not.toHaveBeenCalled();
  });

  it("pays only after a valid secret and a numeric amount", async () => {
    envState.REFERRAL_MANUAL_PAYOUT_SECRET = SECRET;
    const { action } = await import("~/routes/api.referral.manual-payout");
    const response = await action({
      request: post(
        {
          referrer_npub: "npub1example",
          bolt11: "lnbc1",
          amount_sats: 10,
        },
        SECRET
      ),
      params: {},
      context: {},
    });
    expect(response.status).toBe(200);
    expect(pay).toHaveBeenCalledWith("npub1example", "lnbc1", 10);
  });

  it("does not pay when the amount is not a number", async () => {
    envState.REFERRAL_MANUAL_PAYOUT_SECRET = SECRET;
    const { action } = await import("~/routes/api.referral.manual-payout");
    const response = await action({
      request: post(
        {
          referrer_npub: "npub1example",
          bolt11: "lnbc1",
          amount_sats: "10",
        },
        SECRET
      ),
      params: {},
      context: {},
    });
    expect(response.status).toBe(400);
    expect(pay).not.toHaveBeenCalled();
  });
});
