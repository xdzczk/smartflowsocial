import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for shared secrets.
 * A missing, empty, or different-length value never matches.
 */
export function secretsMatch(
  provided: string | undefined,
  expected: string | undefined
): boolean {
  const left = provided?.trim() ?? "";
  const right = expected?.trim() ?? "";
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
