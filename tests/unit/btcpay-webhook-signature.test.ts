import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyBtcpayWebhookSignature } from "~/features/payments/btcpay.server";

describe("verifyBtcpayWebhookSignature", () => {
  const secret = "test-webhook-secret";
  const body = '{"type":"InvoiceSettled","invoiceId":"inv1"}';

  it("accepts valid sha256 HMAC of raw body", () => {
    const sig =
      "sha256=" +
      createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifyBtcpayWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("rejects wrong secret", () => {
    const sig =
      "sha256=" +
      createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifyBtcpayWebhookSignature(body, sig, "other")).toBe(false);
  });

  it("rejects tampered body", () => {
    const sig =
      "sha256=" +
      createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifyBtcpayWebhookSignature(body + " ", sig, secret)).toBe(false);
  });

  it("rejects missing or malformed header", () => {
    expect(verifyBtcpayWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyBtcpayWebhookSignature(body, "nope", secret)).toBe(false);
  });
});
