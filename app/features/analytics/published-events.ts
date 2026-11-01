import { asRecord, contentExcerpt, hex64 } from "~/features/nostrmash/parse";

export function publishedEventId(
  nostrEventId: string | null,
  nostrEvent: unknown
): string | null {
  return hex64(nostrEventId) ?? hex64(asRecord(nostrEvent)?.["id"]);
}

export function publishedNoteExcerpt(
  parts: Array<string | null | undefined>
): string {
  const text = parts.find((part) => part?.trim())?.trim() ?? "";
  return contentExcerpt(text);
}
