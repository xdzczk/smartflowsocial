import { ExternalServiceError } from "~/lib/errors";

export const OWNER_NWC_MISSING = "Owner NWC credentials not configured";

/**
 * Owner NWC `requestPayment` can hang if relays or the wallet never respond.
 * Without a bound, the HTTP request outlives Cloudflare/proxy limits → 520 and no access-log line.
 */
const OWNER_WALLET_INVOICE_REQUEST_MS = 55_000;

export async function withOwnerWalletInvoiceRequestTimeout<T>(
  promise: Promise<T>
): Promise<T> {
  const timeoutError = new ExternalServiceError(
    "Creating the Lightning invoice took too long. Please try again.",
    504,
    { reason: "owner_wallet_invoice_request" }
  );
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(timeoutError),
      OWNER_WALLET_INVOICE_REQUEST_MS
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
