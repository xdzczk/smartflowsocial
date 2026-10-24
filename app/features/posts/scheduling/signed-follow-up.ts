/**
 * Persistence fields for a follow-up whose Nostr event is already signed.
 *
 * Attached follow-ups are discarded at publish time unless `signingState` is
 * `signed`. Storing `signedEvent` alone leaves the column at its default
 * (`unsigned`), and the worker treats that as "not signed".
 */
export function signedFollowUpPersistence(signedEvent: unknown): {
  signingState: "signed";
  signedChildEventId: string;
} | null {
  if (
    !signedEvent ||
    typeof signedEvent !== "object" ||
    Array.isArray(signedEvent) ||
    !("id" in signedEvent)
  ) {
    return null;
  }
  const id = (signedEvent as { id?: unknown }).id;
  if (typeof id !== "string" || id.length === 0) return null;
  return { signingState: "signed", signedChildEventId: id };
}
