import { nostrAdapter } from "~/lib/nostr-adapter.client";

const HEX64 = /^[0-9a-f]{64}$/i;

export function normalizePubkeyInputClient(line: string): string | null {
  const s = line.trim();
  if (!s) return null;
  if (HEX64.test(s)) return s.toLowerCase();
  const decoded = nostrAdapter.decodeNpub(s);
  if (decoded && HEX64.test(decoded)) return decoded.toLowerCase();
  return null;
}

export function parseCustomRecipientPaste(raw: string): {
  parsedLines: number;
  valid: number;
  invalid: number;
  duplicatesRemoved: number;
} {
  const lines = raw
    .split(/[\r\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  let valid = 0;
  let invalid = 0;
  let duplicatesRemoved = 0;
  for (const line of lines) {
    const p = normalizePubkeyInputClient(line);
    if (!p) {
      invalid += 1;
      continue;
    }
    if (seen.has(p)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(p);
    valid += 1;
  }
  return {
    parsedLines: lines.length,
    valid,
    invalid,
    duplicatesRemoved,
  };
}
