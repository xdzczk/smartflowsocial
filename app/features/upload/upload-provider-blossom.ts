/**
 * Shared Blossom provider check that is safe in SSR.
 */
export function isBlossomProvider(provider: string | undefined): boolean {
  return (
    provider === "BLOSSOM_PRIMAL" ||
    provider === "BLOSSOM_BLOSSTR" ||
    provider === "BLOSSOM_SFS" ||
    provider === "BLOSSOM_CUSTOM" ||
    provider === "BLOSSOM"
  );
}
