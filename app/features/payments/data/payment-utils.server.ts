/**
 * Payment utility functions
 * Helper functions for payment processing
 */

import { logError } from "~/lib/error-logger.server";

/**
 * Extract invoice string from request object
 */
export function extractInvoiceFromRequest(request: unknown): string {
  const requestRecord =
    request && typeof request === "object" && !Array.isArray(request)
      ? (request as Record<string, unknown>)
      : {};
  const invoiceValue = requestRecord["invoice"];

  if (typeof invoiceValue === "string") {
    return invoiceValue;
  }

  if (
    invoiceValue &&
    typeof invoiceValue === "object" &&
    !Array.isArray(invoiceValue) &&
    "paymentRequest" in invoiceValue &&
    typeof (invoiceValue as { paymentRequest?: unknown }).paymentRequest ===
      "string"
  ) {
    return (invoiceValue as { paymentRequest: string }).paymentRequest;
  }

  return "";
}

/**
 * Extract payment hash from request object
 */
export function extractPaymentHashFromRequest(request: unknown): string {
  const requestRecord =
    request && typeof request === "object" && !Array.isArray(request)
      ? (request as Record<string, unknown>)
      : {};
  const invoiceValue = requestRecord["invoice"];
  const paymentHashValue = requestRecord["paymentHash"];

  if (typeof paymentHashValue === "string") {
    return paymentHashValue;
  }

  const invoiceObj =
    invoiceValue &&
    typeof invoiceValue === "object" &&
    !Array.isArray(invoiceValue)
      ? (invoiceValue as Record<string, unknown>)
      : null;

  if (invoiceObj && "paymentHash" in invoiceObj) {
    return String(invoiceObj["paymentHash"]);
  }

  return "";
}

/**
 * Get request record from unknown request object
 */
function getRequestRecord(request: unknown): Record<string, unknown> {
  return request && typeof request === "object" && !Array.isArray(request)
    ? (request as Record<string, unknown>)
    : {};
}

/**
 * Get amount from direct property in request record
 */
function getAmountFromDirectProperty(
  requestRecord: Record<string, unknown>
): number | null {
  const amountValue = requestRecord["amount"];
  if (amountValue && typeof amountValue === "number") {
    return amountValue;
  }
  return null;
}

/**
 * Get amount from invoice object in request record
 */
function getAmountFromInvoiceObject(
  requestRecord: Record<string, unknown>
): number | null {
  const invoiceValue = requestRecord["invoice"];
  const invoiceObj =
    invoiceValue &&
    typeof invoiceValue === "object" &&
    !Array.isArray(invoiceValue)
      ? (invoiceValue as Record<string, unknown>)
      : null;

  if (invoiceObj && "satoshi" in invoiceObj) {
    const satoshiValue = Number(invoiceObj["satoshi"]);
    if (!Number.isNaN(satoshiValue)) {
      return satoshiValue;
    }
  }
  return null;
}

/**
 * Get amount from request satoshi property
 */
function getAmountFromRequestSatoshi(request: unknown): number | null {
  if (
    request &&
    typeof request === "object" &&
    "satoshi" in request &&
    typeof (request as { satoshi?: unknown }).satoshi === "number"
  ) {
    return (request as { satoshi: number }).satoshi;
  }
  return null;
}

/**
 * Parse Lightning invoice amount from invoice string
 */
export function parseLightningInvoiceAmount(
  invoiceString: string
): number | null {
  try {
    const invoiceStr = invoiceString.toLowerCase();
    if (!invoiceStr.startsWith("lnbc")) {
      return null;
    }

    const amountMatch = invoiceStr.match(/lnbc([0-9]+)([munp]?)/);
    if (!amountMatch?.[1]) {
      return null;
    }

    const baseAmount = parseInt(amountMatch[1], 10);
    const unit = amountMatch[2];

    if (unit === "m") {
      return baseAmount * 100000;
    }
    if (unit === "u") {
      return baseAmount * 100;
    }
    if (unit === "n") {
      return Math.round(baseAmount * 0.1);
    }
    if (unit === "p") {
      return Math.round(baseAmount * 0.0001);
    }
    return baseAmount * 100000000;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      invoiceString,
      message: "Error parsing Lightning invoice amount",
    });
    return null;
  }
}

/**
 * Extract amount from request with fallback to Bitcoin rate
 */
export async function extractAmountFromRequest(
  request: unknown,
  invoiceString: string,
  amountUsd: number,
  getFallbackAmount: (amountUsd: number) => Promise<number>
): Promise<number> {
  const requestRecord = getRequestRecord(request);

  const directAmount = getAmountFromDirectProperty(requestRecord);
  if (directAmount !== null) {
    return directAmount;
  }

  const invoiceAmount = getAmountFromInvoiceObject(requestRecord);
  if (invoiceAmount !== null) {
    return invoiceAmount;
  }

  const requestSatoshi = getAmountFromRequestSatoshi(request);
  if (requestSatoshi !== null) {
    return requestSatoshi;
  }

  if (typeof invoiceString === "string") {
    const lightningAmount = parseLightningInvoiceAmount(invoiceString);
    if (lightningAmount !== null) {
      return lightningAmount;
    }
  }

  return getFallbackAmount(amountUsd);
}
