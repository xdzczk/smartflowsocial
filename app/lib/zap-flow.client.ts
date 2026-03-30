/**
 * Client-side NIP-57 zap flow: fetch lud16, get invoice from LNURL callback with signed zap request, pay via WebLN.
 * Used by ZapButton; do not import from server modules.
 */

import { nip19 } from "nostr-tools";

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

export interface ZapRecipientOptions {
  npub: string;
  amountSats?: number;
  relays?: string[];
  /** When set, adds an `e` tag so the zap request targets this note (NIP-57). */
  eventIdHex?: string;
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
  /** True if payment was completed via WebLN; false if fallback (e.g. opened in new tab). */
  paid: boolean;
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
 * Run the full NIP-57 zap flow: get lud16 -> LNURL metadata -> build and sign zap request -> callback -> invoice -> webln.sendPayment.
 * Resolves with { paid: true } when payment succeeds; { paid: false } when fallback (e.g. opened in new tab); rejects on failure.
 */
export async function zapRecipient(
  options: ZapRecipientOptions
): Promise<ZapRecipientResult> {
  const { npub, amountSats, relays = DEFAULT_RELAYS, eventIdHex } = options;

  const lud16 = await fetchLud16(npub);
  if (!lud16) {
    throw new Error(ZAP_FLOW_ERROR_NO_LUD16);
  }

  const lnurlPayUrl = lud16ToLnurlPayUrl(lud16);
  const metadata = await fetchLnurlPayMetadata(lnurlPayUrl);

  const millisats = Math.max(
    1000,
    typeof amountSats === "number" && amountSats > 0
      ? Math.round(amountSats * 1000)
      : 1000
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

  const { signedEvent } = await nostrAdapter.signEventWithOneRetry({
    kind: 9734,
    content: "",
    tags,
    created_at,
  });

  const callbackUrl = new URL(metadata.callback);
  callbackUrl.searchParams.set("amount", String(millisats));
  callbackUrl.searchParams.set("nostr", JSON.stringify(signedEvent));

  const callbackRes = await fetch(callbackUrl.toString(), {
    signal: AbortSignal.timeout(15000),
  });
  if (!callbackRes.ok) throw new Error(ZAP_FLOW_ERROR_INVOICE);

  const callbackData = (await callbackRes.json()) as {
    pr?: string;
    error?: string;
  };
  const pr = callbackData.pr;
  if (typeof pr !== "string" || pr.trim() === "") {
    throw new Error(callbackData.error ?? ZAP_FLOW_ERROR_INVOICE);
  }

  if (typeof window === "undefined") {
    throw new Error(ZAP_FLOW_ERROR_NO_WEBLN);
  }
  if (!window.webln?.sendPayment) {
    throw new Error(ZAP_FLOW_ERROR_NO_WEBLN);
  }

  try {
    await window.webln.enable?.();
  } catch {
    throw new Error(ZAP_FLOW_ERROR_NO_WEBLN);
  }

  await window.webln.sendPayment(pr);
  return { paid: true };
}
