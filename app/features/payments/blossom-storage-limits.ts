/**
 * Blossom (SFS) storage limits per plan in bytes.
 * Used by the Blossom Media Manager to show used/limit.
 */

const BYTES_PER_GB = 1024 * 1024 * 1024;
const BYTES_PER_MB = 1024 * 1024;

/** Storage limit in bytes per plan id. Free = 50 MB; paid tiers get more. */
const BLOSSOM_STORAGE_LIMIT_BYTES: Record<string, number> = {
  free: 50 * BYTES_PER_MB,
  starter: 5 * BYTES_PER_GB,
  creator: 10 * BYTES_PER_GB,
  pro: 50 * BYTES_PER_GB,
  teams: 50 * BYTES_PER_GB,
  founder: 50 * BYTES_PER_GB,
};

/**
 * Returns the Blossom (SFS) storage limit in bytes for the given plan id.
 * Returns 0 if plan is unknown (e.g. no subscription).
 */
export function getBlossomStorageLimitBytes(planId: string | null): number {
  if (!planId) return 0;
  const key = planId.toLowerCase();
  return BLOSSOM_STORAGE_LIMIT_BYTES[key] ?? 0;
}
