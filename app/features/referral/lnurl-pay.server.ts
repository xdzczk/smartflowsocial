/**
 * Minimal LNURL pay: fetch a BOLT11 invoice for a given amount from an LNURL pay endpoint.
 * Supports payout_destination that is a URL returning LNURL pay JSON (callback, minSendable, maxSendable).
 */

export async function fetchInvoiceFromLnurlPay(
  url: string,
  amountSats: number
): Promise<string | null> {
  const millisats = Math.round(amountSats * 1000);
  if (millisats < 1000) return null;

  let meta: { callback?: string; minSendable?: number; maxSendable?: number };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (typeof data !== "object" || data === null) return null;
    meta = data;
  } catch {
    return null;
  }

  const callback = typeof meta.callback === "string" ? meta.callback : "";
  if (!callback) return null;

  const min = typeof meta.minSendable === "number" ? meta.minSendable : 0;
  const max =
    typeof meta.maxSendable === "number"
      ? meta.maxSendable
      : Number.MAX_SAFE_INTEGER;
  if (millisats < min || millisats > max) return null;

  const callbackUrl = callback.includes("?")
    ? `${callback}&amount=${millisats}`
    : `${callback}?amount=${millisats}`;

  try {
    const payRes = await fetch(callbackUrl, {
      signal: AbortSignal.timeout(10000),
    });
    if (!payRes.ok) return null;
    const payData = (await payRes.json()) as unknown;
    if (typeof payData !== "object" || payData === null) return null;
    const pr = (payData as { pr?: string }).pr;
    return typeof pr === "string" ? pr : null;
  } catch {
    return null;
  }
}
