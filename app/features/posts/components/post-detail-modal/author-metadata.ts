/** Display name from thread metadata map (kind-0 profile JSON), else short hex. */
export function getPubkeyDisplayName(
  pubkey: string,
  metadata: Record<string, unknown>
): string {
  const meta = metadata[pubkey];
  let name = `${pubkey.slice(0, 8)}…`;
  if (
    meta &&
    typeof meta === "object" &&
    !Array.isArray(meta) &&
    "content" in meta
  ) {
    try {
      const raw = (meta as { content?: unknown }).content;
      const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>;
        const d =
          typeof p["display_name"] === "string" ? p["display_name"] : undefined;
        const n = typeof p["name"] === "string" ? p["name"] : undefined;
        name = d ?? n ?? name;
      }
    } catch {
      /* ignore */
    }
  }
  return name;
}
