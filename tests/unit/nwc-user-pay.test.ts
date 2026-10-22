import { beforeEach, describe, expect, it, vi } from "vitest";

const { payInvoice, getInfo, getBudget, close } = vi.hoisted(() => ({
  payInvoice: vi.fn(),
  getInfo: vi.fn(),
  getBudget: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@getalby/sdk", () => ({
  NWCClient: class {
    payInvoice = payInvoice;
    getInfo = getInfo;
    getBudget = getBudget;
    close = close;
    constructor(_opts?: unknown) {}
  },
}));

import {
  assertUserNwcCanPay,
  classifyNwcPayError,
  NwcChargeError,
  nwcChargeFailureNotice,
  payBolt11WithUserNwc,
} from "~/features/payments/services/nwc-user-pay.server";

describe("nwc user pay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInfo.mockResolvedValue({ methods: ["pay_invoice", "get_budget"] });
    getBudget.mockResolvedValue({});
    payInvoice.mockResolvedValue({ preimage: "abc123" });
  });

  it("requires a preimage before treating a wallet payment as successful", async () => {
    payInvoice.mockResolvedValue({ fees_paid: 1 });

    await expect(payBolt11WithUserNwc("nwc://user", "lnbc1")).rejects.toEqual(
      expect.objectContaining({
        name: "NwcChargeError",
        kind: "unconfirmed",
      })
    );
    expect(close).toHaveBeenCalled();
  });

  it("returns the preimage and closes the client", async () => {
    await expect(payBolt11WithUserNwc("nwc://user", "lnbc1")).resolves.toBe(
      "abc123"
    );
    expect(close).toHaveBeenCalled();
  });

  it("classifies a pay timeout as unconfirmed", async () => {
    payInvoice.mockImplementation(() => new Promise(() => undefined));
    vi.useFakeTimers();
    try {
      const pending = payBolt11WithUserNwc("nwc://user", "lnbc1");
      const assertion = expect(pending).rejects.toBeInstanceOf(NwcChargeError);
      await vi.advanceTimersByTimeAsync(55_000);
      await assertion;
      await expect(pending).rejects.toMatchObject({ kind: "unconfirmed" });
    } finally {
      vi.useRealTimers();
    }
    expect(close).toHaveBeenCalled();
  });

  it("classifies quota errors as a wallet rejection", () => {
    const error = new Error("Quota exceeded");
    error.name = "Nip47WalletError";
    Object.assign(error, { code: "QUOTA_EXCEEDED" });
    expect(classifyNwcPayError(error)).toBe("wallet_rejected");
    expect(nwcChargeFailureNotice("wallet_rejected")).toContain("budget");
  });

  it("does not create a charge when the wallet cannot be reached", async () => {
    getInfo.mockRejectedValue(new Error("websocket closed"));

    await expect(assertUserNwcCanPay("nwc://user")).rejects.toMatchObject({
      kind: "connection_dead",
    });
    expect(nwcChargeFailureNotice("connection_dead")).toContain("Reconnect");
  });

  it("stops before payment when the spending budget is used up", async () => {
    getBudget.mockResolvedValue({
      total_budget: 1000,
      used_budget: 1000,
      renewal_period: "monthly",
    });

    await expect(assertUserNwcCanPay("nwc://user")).rejects.toMatchObject({
      kind: "wallet_rejected",
    });
  });

  it("continues when the wallet does not report a budget", async () => {
    getBudget.mockRejectedValue(new Error("NOT_IMPLEMENTED"));
    await expect(assertUserNwcCanPay("nwc://user")).resolves.toBeUndefined();
  });

  it("rejects a connection that cannot pay invoices", async () => {
    getInfo.mockResolvedValue({ methods: ["get_balance"] });
    await expect(assertUserNwcCanPay("nwc://user")).rejects.toMatchObject({
      kind: "connection_dead",
    });
  });
});
