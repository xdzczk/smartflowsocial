import { describe, expect, it } from "vitest";

import {
  BTCPAY_MIN_ONCHAIN_CONFIRMS_FOR_ACCESS,
  parseBtcpayInvoiceOnChainSnapshot,
} from "~/features/payments/btcpay.server";

describe("parseBtcpayInvoiceOnChainSnapshot", () => {
  it("returns no on-chain activity for empty payments", () => {
    expect(
      parseBtcpayInvoiceOnChainSnapshot({
        status: "New",
        payments: [],
      })
    ).toEqual({
      invoiceStatus: "New",
      maxOnChainConfirmations: 0,
      hasOnChainPaymentStarted: false,
    });
  });

  it("detects 0-conf on-chain payment", () => {
    const snap = parseBtcpayInvoiceOnChainSnapshot({
      status: "Processing",
      payments: [
        {
          paymentMethodId: "BTC-OnChain",
          confirmations: 0,
          status: "Processing",
        },
      ],
    });
    expect(snap.hasOnChainPaymentStarted).toBe(true);
    expect(snap.maxOnChainConfirmations).toBe(0);
    expect(snap.invoiceStatus).toBe("Processing");
    expect(
      snap.maxOnChainConfirmations < BTCPAY_MIN_ONCHAIN_CONFIRMS_FOR_ACCESS
    ).toBe(true);
  });

  it("reads max confirmations across on-chain rows", () => {
    const snap = parseBtcpayInvoiceOnChainSnapshot({
      status: "Settled",
      payments: [
        { paymentMethodId: "BTC-OnChain", confirmations: 1 },
        { paymentMethodId: "BTC-OnChain", confirmations: 0 },
      ],
    });
    expect(snap.maxOnChainConfirmations).toBe(1);
    expect(snap.hasOnChainPaymentStarted).toBe(true);
  });

  it("ignores Lightning payment rows", () => {
    const snap = parseBtcpayInvoiceOnChainSnapshot({
      status: "Settled",
      payments: [
        {
          paymentMethodId: "BTC-LNURLPay",
          confirmations: 0,
        },
      ],
    });
    expect(snap.hasOnChainPaymentStarted).toBe(false);
    expect(snap.maxOnChainConfirmations).toBe(0);
  });

  it("accepts paymentMethod as fallback field name", () => {
    const snap = parseBtcpayInvoiceOnChainSnapshot({
      status: "Processing",
      payments: [{ paymentMethod: "BTC-OnChain", confirmations: 2 }],
    });
    expect(snap.maxOnChainConfirmations).toBe(2);
    expect(snap.hasOnChainPaymentStarted).toBe(true);
  });
});
