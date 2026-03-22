export function shortHexPubkey(hex: string): string {
  const h = hex.trim().toLowerCase();
  if (h.length <= 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}
