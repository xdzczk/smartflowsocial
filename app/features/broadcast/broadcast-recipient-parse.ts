/**
 * Structured recipient parsing for Audience Builder v2 (client + server).
 * Validation does not depend on profile metadata.
 */

import { nostrAdapter } from "~/lib/nostr-adapter.client";

const HEX64 = /^[0-9a-f]{64}$/i;

export type RecipientParseStatus =
  | "valid"
  | "duplicate"
  | "invalid_format"
  | "invalid_length"
  | "unsupported_link"
  | "empty";

export interface ParsedRecipientRow {
  raw: string;
  normalizedHex: string | null;
  status: RecipientParseStatus;
}

export interface RecipientParseSummary {
  parsed: number;
  valid: number;
  duplicates: number;
  invalid: number;
  finalSendable: number;
}

function normalizePubkeyInput(line: string): string | null {
  const s = line.trim();
  if (!s) return null;
  if (HEX64.test(s)) return s.toLowerCase();
  const decoded = nostrAdapter.decodeNpub(s);
  if (decoded && HEX64.test(decoded)) return decoded.toLowerCase();
  return null;
}

/** Extract npub or 64-char hex from a URL or free text. */
function extractPubkeyFromToken(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  const direct = normalizePubkeyInput(t);
  if (direct) return direct;
  const npubMatch = t.match(/npub1[a-z0-9]{50,}/i);
  if (npubMatch) return normalizePubkeyInput(npubMatch[0]);
  const hexMatch = t.match(/[0-9a-f]{64}/i);
  if (hexMatch) return normalizePubkeyInput(hexMatch[0]);
  return null;
}

/**
 * Split paste into tokens (newlines, commas, semicolons, whitespace).
 */
export function tokenizeRecipientPaste(raw: string): string[] {
  const s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const out: string[] = [];
  for (const line of s.split("\n")) {
    for (const chunk of line.split(/[,;]+/)) {
      for (const w of chunk.split(/\s+/)) {
        const t = w.trim();
        if (t) out.push(t);
      }
    }
  }
  return out;
}

export function parseRecipientInput(raw: string): {
  rows: ParsedRecipientRow[];
  summary: RecipientParseSummary;
} {
  const tokens = tokenizeRecipientPaste(raw);
  const rows: ParsedRecipientRow[] = [];
  const seen = new Set<string>();
  let valid = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const token of tokens) {
    const hex = extractPubkeyFromToken(token);
    if (!hex) {
      const status: RecipientParseStatus = token.includes("http")
        ? "unsupported_link"
        : "invalid_format";
      rows.push({ raw: token, normalizedHex: null, status });
      invalid += 1;
      continue;
    }
    if (seen.has(hex)) {
      rows.push({ raw: token, normalizedHex: hex, status: "duplicate" });
      duplicates += 1;
      continue;
    }
    seen.add(hex);
    rows.push({ raw: token, normalizedHex: hex, status: "valid" });
    valid += 1;
  }

  const summary: RecipientParseSummary = {
    parsed: tokens.length,
    valid,
    duplicates,
    invalid,
    finalSendable: valid,
  };

  return { rows, summary };
}

/** Hex lines for server `customNpubLines` / form submission. */
export function validHexLinesFromRows(rows: ParsedRecipientRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (r.status !== "valid" || !r.normalizedHex) continue;
    if (seen.has(r.normalizedHex)) continue;
    seen.add(r.normalizedHex);
    out.push(r.normalizedHex);
  }
  return out;
}
