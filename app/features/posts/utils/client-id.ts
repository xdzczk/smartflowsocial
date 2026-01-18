/**
 * Create stable client-side ids for bulk post UI rows.
 *
 * We avoid using changing fields (caption/scheduledFor) as React keys because
 * that remounts rows during typing and breaks focus in `datetime-local` inputs.
 */
export function createBulkPostClientId(prefix = "bulkpost"): string {
  // Modern browsers / Node 19+ support crypto.randomUUID()
  try {
    const maybeCrypto = globalThis.crypto as unknown;
    const randomUUID =
      maybeCrypto &&
      typeof maybeCrypto === "object" &&
      "randomUUID" in maybeCrypto &&
      typeof (maybeCrypto as { randomUUID?: unknown }).randomUUID === "function"
        ? (maybeCrypto as { randomUUID: () => string }).randomUUID
        : null;

    if (randomUUID) {
      return `${prefix}_${randomUUID()}`;
    }
  } catch {
    // ignore
  }

  // Fallback: good-enough uniqueness for UI keys
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
