/** Client-only label for pasted global search input (no server imports). */
export type NostrPasteKindLabel =
  | "Note"
  | "Event"
  | "Addressable"
  | "Hex id"
  | "URL"
  | null;

export function detectNostrPasteKind(raw: string): NostrPasteKindLabel {
  const t = raw.trim();
  if (!t || t.length < 2) return null;
  if (/^https?:\/\//i.test(t)) return "URL";
  const noPrefix = t.startsWith("nostr:") ? t.slice(6).trim() : t;
  if (/^naddr1/i.test(noPrefix)) return "Addressable";
  if (/^nevent1/i.test(noPrefix)) return "Event";
  if (/^note1/i.test(noPrefix)) return "Note";
  if (/^[0-9a-f]{64}$/i.test(noPrefix)) return "Hex id";
  return null;
}
