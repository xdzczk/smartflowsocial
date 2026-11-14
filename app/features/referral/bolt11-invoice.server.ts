import { decode } from "@gandlaf21/bolt11-decode";

const DEFAULT_EXPIRY_SECONDS = 3600;
const MSATS_PER_SAT = 1000n;
const MALFORMED_INVOICE = "Malformed BOLT11 invoice";

export type Bolt11ReadResult =
  | { ok: true; amountSats: number; paymentHash: string }
  | { ok: false; error: string };

interface Bolt11Section {
  name?: string;
  value?: unknown;
  letters?: string;
}

/**
 * Reads the payable amount and payment hash from a BOLT11 invoice.
 * Amountless, malformed, non-mainnet, and expired invoices are rejected.
 * The decoded amount is in whole sats and must be compared with the caller's
 * declared amount before any wallet call.
 */
export function readBolt11ForPayout(
  invoice: string,
  nowMs: number = Date.now()
): Bolt11ReadResult {
  const trimmed = invoice.trim();
  if (!trimmed) return { ok: false, error: MALFORMED_INVOICE };

  let decoded: unknown;
  try {
    decoded = decode(trimmed);
  } catch {
    return { ok: false, error: MALFORMED_INVOICE };
  }

  const sections = sectionsOf(decoded);
  if (!sections) return { ok: false, error: MALFORMED_INVOICE };

  const network = sections.find((section) => section.name === "coin_network");
  const networkLetters =
    typeof network?.letters === "string" ? network.letters.toLowerCase() : "";
  if (networkLetters !== "bc") {
    return { ok: false, error: "Only mainnet BOLT11 invoices can be paid" };
  }

  const amount = sections.find((section) => section.name === "amount");
  const amountResult = amountSatsFromMillisatoshis(amount?.value);
  if (!amountResult.ok) return amountResult;

  const hashSection = sections.find(
    (section) => section.name === "payment_hash"
  );
  const paymentHash = paymentHashHex(hashSection?.value);
  if (!paymentHash) return { ok: false, error: MALFORMED_INVOICE };

  const timestamp = numericSection(sections, "timestamp");
  const expiry = numericSection(sections, "expiry") ?? DEFAULT_EXPIRY_SECONDS;
  if (timestamp === null) {
    return { ok: false, error: MALFORMED_INVOICE };
  }
  const expiresAtMs = (timestamp + expiry) * 1000;
  if (nowMs >= expiresAtMs) {
    return { ok: false, error: "BOLT11 invoice is expired" };
  }

  return {
    ok: true,
    amountSats: amountResult.amountSats,
    paymentHash,
  };
}

export function amountSatsFromMillisatoshis(
  value: unknown
): { ok: true; amountSats: number } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return {
      ok: false,
      error: "Amountless BOLT11 invoices cannot be paid",
    };
  }
  const raw = typeof value === "string" ? value : String(value);
  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: MALFORMED_INVOICE };
  }
  const msats = BigInt(raw);
  if (msats <= 0n || msats % MSATS_PER_SAT !== 0n) {
    return {
      ok: false,
      error: "BOLT11 amount must be a positive whole number of sats",
    };
  }
  const sats = msats / MSATS_PER_SAT;
  if (sats > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, error: "BOLT11 amount is too large" };
  }
  return { ok: true, amountSats: Number(sats) };
}

function sectionsOf(decoded: unknown): Bolt11Section[] | null {
  if (!decoded || typeof decoded !== "object" || !("sections" in decoded)) {
    return null;
  }
  const sections = (decoded as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return null;
  return sections as Bolt11Section[];
}

function numericSection(
  sections: Bolt11Section[],
  name: string
): number | null {
  const section = sections.find((item) => item.name === name);
  if (!section) return null;
  const value = section.value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function paymentHashHex(value: unknown): string | null {
  if (typeof value === "string" && /^[0-9a-fA-F]{64}$/.test(value)) {
    return value.toLowerCase();
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return value.length === 32 ? value.toString("hex") : null;
  }
  if (value instanceof Uint8Array && value.byteLength === 32) {
    return Buffer.from(value).toString("hex");
  }
  return null;
}
