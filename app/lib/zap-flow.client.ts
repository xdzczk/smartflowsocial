/**
 * Client-side NIP-57 zap flow: fetch lud16, get invoice from LNURL callback with signed zap request,
 * then pay via NWC (when the user has NWC saved) or WebLN.
 * Used by ZapButton; do not import from server modules.
 */

import { nip19 } from "nostr-tools";

import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import {
  durableIntent,
  startRecoverableSign,
} from "~/features/auth/signing/use-recoverable-sign.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.snort.social",
  "wss://nostr.wine",
  "wss://nos.lol",
];

export const ZAP_FLOW_ERROR_NO_LUD16 = "Recipient has no Lightning address";
export const ZAP_FLOW_ERROR_NO_WEBLN =
  "Install a Lightning wallet with WebLN support to zap from this page";
export const ZAP_FLOW_ERROR_LNURL =
  "Could not load recipient Lightning pay link";
export const ZAP_FLOW_ERROR_INVOICE = "Could not get invoice";
export const ZAP_FLOW_ERROR_PAYMENT = "Payment failed";
/** WebLN did not settle within {@link WEBLN_SEND_PAYMENT_TIMEOUT_MS} (wallet UI stuck, slow routing, etc.). */
export const ZAP_FLOW_ERROR_WEBLN_TIMEOUT =
  "Payment timed out waiting for your wallet";

/** Max time to wait for `webln.sendPayment` before falling back to invoice/QR (many wallets never reject if routing hangs). */
export const WEBLN_SEND_PAYMENT_TIMEOUT_MS = 120_000;

export async function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutError: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutError));
      }, ms);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Whole sats (> 0) for LNURL/zap amount tags.
 * Remix/JSON sometimes yields numeric strings; strict `typeof === "number"` would wrongly fall back to 1 sat.
 */
export function coercePositiveAmountSats(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.floor(value));
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (t === "") return undefined;
    const n = Number(t);
    if (Number.isFinite(n) && n > 0) {
      return Math.max(1, Math.floor(n));
    }
  }
  if (typeof value === "bigint" && value > 0n) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) {
      return Math.max(1, Math.floor(n));
    }
  }
  return undefined;
}

export interface ZapRecipientOptions {
  npub: string;
  /** Prefer `number`; string/bigint coerced at runtime (loader JSON edge cases). */
  amountSats?: number | string;
  relays?: string[];
  /** When set, adds an `e` tag so the zap request targets this note (NIP-57). */
  eventIdHex?: string;
  /** When true, return invoice instead of throwing when no local wallet payment path exists. */
  returnInvoiceOnNoWallet?: boolean;
}

/**
 * Resolve Lightning Address (lud16) to LNURL pay URL.
 * user@domain.com -> https://domain.com/.well-known/lnurlp/user
 */
function lud16ToLnurlPayUrl(lud16: string): string {
  const trimmed = lud16.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    throw new Error("Invalid Lightning address");
  }
  const user = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return `https://${domain}/.well-known/lnurlp/${user}`;
}

/**
 * Fetch lud16 for npub from our API.
 */
async function fetchLud16(npub: string): Promise<string | null> {
  const res = await fetch(`/api/zap-profile?npub=${encodeURIComponent(npub)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lud16?: string | null };
  const lud16 = data.lud16;
  return typeof lud16 === "string" && lud16.trim() !== "" ? lud16.trim() : null;
}

/**
 * Fetch LNURL pay metadata (callback, allowsNostr, etc.).
 */
async function fetchLnurlPayMetadata(lnurlPayUrl: string): Promise<{
  callback: string;
  allowsNostr?: boolean;
  nostrPubkey?: string;
  minSendable?: number;
  maxSendable?: number;
}> {
  const res = await fetch(lnurlPayUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(ZAP_FLOW_ERROR_LNURL);
  const data = (await res.json()) as {
    callback?: string;
    allowsNostr?: boolean;
    nostrPubkey?: string;
    minSendable?: number;
    maxSendable?: number;
  };
  if (typeof data.callback !== "string" || data.callback.trim() === "") {
    throw new Error(ZAP_FLOW_ERROR_LNURL);
  }
  return {
    callback: data.callback.trim(),
    allowsNostr: data.allowsNostr === true,
    nostrPubkey: data.nostrPubkey,
    minSendable: data.minSendable,
    maxSendable: data.maxSendable,
  };
}

/**
 * Decode npub to hex pubkey.
 */
function npubToHex(npub: string): string {
  const decoded = nip19.decode(npub);
  if (decoded.type !== "npub") throw new Error("Invalid npub");
  return decoded.data;
}

export interface ZapRecipientResult {
  /** True if payment completed (NWC or WebLN); false if fallback (e.g. opened in new tab). */
  paid: boolean;
  /** BOLT11 invoice (when generated) for external/manual payment fallback. */
  invoice?: string;
  /** True when WebLN did not complete before the timeout (see {@link WEBLN_SEND_PAYMENT_TIMEOUT_MS}). */
  weblnTimedOut?: boolean;
}

/**
 * Pay zap invoice with server-side NWC when the user is signed in and has NWC enabled.
 * Returns true if paid; false if unauthenticated or no NWC (caller should try WebLN).
 */
async function payZapInvoiceWithNwcIfAvailable(
  bolt11: string
): Promise<boolean> {
  const res = await fetch("/api/zap-pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ invoice: bolt11 }),
    signal: AbortSignal.timeout(120_000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    code?: string;
    error?: string;
    ok?: boolean;
  };

  if (res.status === 401) {
    return false;
  }
  if (res.status === 400 && data.code === "NO_NWC") {
    return false;
  }
  if (!res.ok) {
    throw new Error(data.error ?? ZAP_FLOW_ERROR_PAYMENT);
  }
  return data.ok === true;
}

/** Build kind 9734 tags for LNURL zap request (NIP-57). */
export function buildZapRequestKind9734Tags(params: {
  recipientHex: string;
  millisats: number;
  relays: string[];
  eventIdHex?: string;
}): string[][] {
  const { recipientHex, millisats, relays, eventIdHex } = params;
  return [
    ["p", recipientHex],
    ...(eventIdHex && /^[a-fA-F0-9]{64}$/.test(eventIdHex)
      ? ([["e", eventIdHex.toLowerCase()]] as string[][])
      : []),
    ["amount", String(millisats)],
    ["relays", ...relays],
  ];
}

/**
 * Run the full NIP-57 zap flow: get lud16 -> LNURL metadata -> build and sign zap request -> callback -> invoice ->
 * pay via NWC (if configured) or WebLN.
 * Resolves with { paid: true } when payment succeeds; { paid: false } when fallback (e.g. opened in new tab); rejects on failure.
 */
export async function zapRecipient(
  options: ZapRecipientOptions
): Promise<ZapRecipientResult> {
  const {
    npub,
    amountSats,
    relays = DEFAULT_RELAYS,
    eventIdHex,
    returnInvoiceOnNoWallet = false,
  } = options;

  const lud16 = await fetchLud16(npub);
  if (!lud16) {
    throw new Error(ZAP_FLOW_ERROR_NO_LUD16);
  }

  const lnurlPayUrl = lud16ToLnurlPayUrl(lud16);
  const metadata = await fetchLnurlPayMetadata(lnurlPayUrl);

  const sats = coercePositiveAmountSats(amountSats);
  const millisats = Math.max(
    1000,
    sats !== undefined ? Math.round(sats * 1000) : 1000
  );

  if (metadata.allowsNostr !== true) {
    // Fallback: open callback with amount only (no signed zap request). Caller should not auto-mark.
    const callbackUrl = metadata.callback.includes("?")
      ? `${metadata.callback}&amount=${millisats}`
      : `${metadata.callback}?amount=${millisats}`;
    if (typeof window !== "undefined") {
      window.open(callbackUrl, "_blank", "noopener,noreferrer");
    }
    return { paid: false };
  }

  const recipientHex = npubToHex(npub);
  const created_at = Math.floor(Date.now() / 1000);
  const tags = buildZapRequestKind9734Tags({
    recipientHex,
    millisats,
    relays,
    eventIdHex,
  });

  // Wrap the sign + LNURL callback in a recoverable signing attempt so
  // a bunker drop mid-zap parks the attempt in `awaiting_signer` and
  // resumes when the bunker comes back, instead of surfacing a raw
  // `RemoteSignerTimeoutError` to the user. Idempotency key scopes the
  // recovery to (recipient, target event, submission instant) so a
  // resumed attempt doesn't double-sign a stale request from a prior
  // click  -  the user can click Zap again to start a fresh attempt.
  //
  // Scope of the recoverable boundary: sign + LNURL callback fetch
  // only. Once we have an invoice (`pr`), the signing concern is
  // settled; the payment step (NWC / WebLN) has its own error handling
  // and is not subject to signer recovery.
  const idempotencyKey = `zap:${recipientHex}:${eventIdHex ?? "none"}:${created_at}`;

  // `invoiceCarrier` is mutated inside the `performSignAndSubmit`
  // closure below; the explicit type widens past TypeScript's narrowing
  // so the post-call `!invoiceCarrier` guard is recognised as a real
  // runtime check rather than dead code (the closure may not run if
  // the attempt is cancelled / expired before it executes).
  let invoiceCarrier: { pr: string } | null = null as { pr: string } | null;
  let lastInvoiceError: string | null = null;
  const signResult = await startRecoverableSign({
    intent: durableIntent("publish_zap_request", idempotencyKey, "Zap"),
    surface: `zap:${recipientHex}${eventIdHex ? `:${eventIdHex}` : ""}`,
    performSignAndSubmit: async (submissionId) => {
      const { signedEvent } = await nostrAdapter.signEvent(
        {
          kind: 9734,
          content: "",
          tags,
          created_at,
        },
        { clearCacheOnError: false }
      );

      const callbackUrl = new URL(metadata.callback);
      callbackUrl.searchParams.set("amount", String(millisats));
      callbackUrl.searchParams.set("nostr", JSON.stringify(signedEvent));

      const callbackRes = await fetch(callbackUrl.toString(), {
        signal: AbortSignal.timeout(15000),
      });
      if (!callbackRes.ok) {
        const message = ZAP_FLOW_ERROR_INVOICE;
        lastInvoiceError = message;
        signingAttempts.markFailed(submissionId, message);
        throw new Error(message);
      }

      const callbackData = (await callbackRes.json()) as {
        pr?: string;
        error?: string;
      };
      const pr = callbackData.pr;
      if (typeof pr !== "string" || pr.trim() === "") {
        const message = callbackData.error ?? ZAP_FLOW_ERROR_INVOICE;
        lastInvoiceError = message;
        signingAttempts.markFailed(submissionId, message);
        throw new Error(message);
      }

      invoiceCarrier = { pr };
      signingAttempts.markCompleted(submissionId);
    },
  });

  if (!signResult.ok || !invoiceCarrier) {
    // Preserve the legacy throwing contract for `zapRecipient` callers
    // (ZapButton, ZapNoteDrawer). The recovery banner already surfaces
    // the awaiting-signer affordance during `awaiting_signer`; we only
    // throw once the attempt resolves to a terminal failure.
    const message =
      (signResult.ok ? null : signResult.lastError) ??
      lastInvoiceError ??
      ZAP_FLOW_ERROR_INVOICE;
    throw new Error(message);
  }
  const { pr } = invoiceCarrier;

  if (typeof window === "undefined") {
    throw new Error(ZAP_FLOW_ERROR_NO_WEBLN);
  }

  const paidViaNwc = await payZapInvoiceWithNwcIfAvailable(pr);
  if (paidViaNwc) {
    return { paid: true };
  }

  if (!window.webln?.sendPayment) {
    if (returnInvoiceOnNoWallet) {
      return { paid: false, invoice: pr };
    }
    throw new Error(ZAP_FLOW_ERROR_NO_WEBLN);
  }

  try {
    await window.webln.enable?.();
  } catch {
    throw new Error(ZAP_FLOW_ERROR_NO_WEBLN);
  }

  try {
    // Alby and other WebLN providers often leave `sendPayment` pending until the preimage
    // returns; routing failures can stall indefinitely. Race with a timeout so manual payout
    // can fall back to QR / copy.
    await raceWithTimeout(
      window.webln.sendPayment(pr),
      WEBLN_SEND_PAYMENT_TIMEOUT_MS,
      ZAP_FLOW_ERROR_WEBLN_TIMEOUT
    );
    return { paid: true };
  } catch (err) {
    if (returnInvoiceOnNoWallet) {
      const timedOut =
        err instanceof Error && err.message === ZAP_FLOW_ERROR_WEBLN_TIMEOUT;
      return { paid: false, invoice: pr, weblnTimedOut: timedOut };
    }
    if (err instanceof Error && err.message === ZAP_FLOW_ERROR_WEBLN_TIMEOUT) {
      throw err;
    }
    throw new Error(ZAP_FLOW_ERROR_PAYMENT);
  }
}
