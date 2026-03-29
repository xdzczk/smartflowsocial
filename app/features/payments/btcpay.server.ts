/**
 * BTCPay Server Greenfield API (Founder on-chain checkout) + webhook signature verification.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { ExternalServiceError } from "~/lib/errors";

export function isBtcpayConfigured(): boolean {
  const url = env.BTCPAY_URL?.trim();
  const key = env.BTCPAY_API_KEY?.trim();
  const store = env.BTCPAY_STORE_ID?.trim();
  return Boolean(url && key && store);
}

function baseUrl(): string {
  return env.BTCPAY_URL!.trim().replace(/\/$/, "");
}

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `token ${env.BTCPAY_API_KEY!.trim()}`,
  };
}

export interface BtcpayInvoiceCreateResult {
  id: string;
  checkoutLink: string;
  expirationTime?: number;
}

function extractBtcpayErrorMessage(data: unknown, fallback: string): string {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof (data as { message: unknown }).message === "string"
  ) {
    return (data as { message: string }).message;
  }
  return fallback;
}

function asRecord(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object") {
    return data as Record<string, unknown>;
  }
  return {};
}

export async function btcpayCreateInvoice(params: {
  amountUsd: number;
  paymentId: string;
  userId: string;
  planId: string;
  planLabel: string;
}): Promise<BtcpayInvoiceCreateResult> {
  if (!isBtcpayConfigured()) {
    throw new Error("BTCPay is not configured");
  }

  const amountStr = params.amountUsd.toFixed(2);
  const storeId = env.BTCPAY_STORE_ID!.trim();
  const url = `${baseUrl()}/api/v1/stores/${encodeURIComponent(storeId)}/invoices`;

  const body: Record<string, unknown> = {
    amount: amountStr,
    currency: "USD",
    metadata: {
      smartflowPaymentId: params.paymentId,
      smartflowUserId: params.userId,
      smartflowPlanId: params.planId,
    },
  };

  const appUrl = env.APP_URL?.trim();
  if (appUrl) {
    body["checkout"] = {
      redirectURL: `${appUrl.replace(/\/$/, "")}/dashboard?btcpayPaid=1`,
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = extractBtcpayErrorMessage(data, text || res.statusText);
    logError(new Error(`BTCPay create invoice failed: ${msg}`), {
      status: res.status,
      paymentId: params.paymentId,
    });
    throw new ExternalServiceError(
      "Could not start Bitcoin checkout. Please try again later.",
      res.status >= 500 ? 502 : 400,
      { btcpayStatus: res.status }
    );
  }

  const obj = asRecord(data);
  const id = typeof obj["id"] === "string" ? obj["id"] : "";
  const checkoutLink =
    typeof obj["checkoutLink"] === "string" ? obj["checkoutLink"] : "";
  const expirationTime =
    typeof obj["expirationTime"] === "number"
      ? obj["expirationTime"]
      : undefined;

  if (!id || !checkoutLink) {
    logError(new Error("BTCPay invoice response missing id or checkoutLink"), {
      paymentId: params.paymentId,
    });
    throw new ExternalServiceError(
      "Invalid response from payment provider.",
      502,
      {}
    );
  }

  return { id, checkoutLink, expirationTime };
}

export async function btcpayGetInvoice(
  btcpayInvoiceId: string
): Promise<{ status: string }> {
  if (!isBtcpayConfigured()) {
    throw new Error("BTCPay is not configured");
  }
  const storeId = env.BTCPAY_STORE_ID!.trim();
  const url = `${baseUrl()}/api/v1/stores/${encodeURIComponent(storeId)}/invoices/${encodeURIComponent(btcpayInvoiceId)}`;

  const res = await fetch(url, { headers: authHeaders() });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ExternalServiceError(
      "BTCPay invoice lookup failed",
      res.status,
      {}
    );
  }

  const obj = asRecord(data);
  const status = typeof obj["status"] === "string" ? obj["status"] : "";
  return { status };
}

export function verifyBtcpayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader?.startsWith("sha256=") || !secret) {
    return false;
  }
  const sigHex = signatureHeader.slice("sha256=".length).trim();
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    const a = Buffer.from(sigHex, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || a.length === 0) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
