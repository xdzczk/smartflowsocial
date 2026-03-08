/**
 * Random schedule window helper (Option A: random at schedule time).
 * Used so posts are published at a random time within ±windowMinutes of the nominal time.
 * Safe to use on both client and server (uses Math.random()).
 */

/**
 * Returns a random Unix timestamp (seconds) within [nominal - windowMinutes, nominal + windowMinutes].
 * Does not clamp to "now"; caller should pass a nominal time that is already in the future if required.
 *
 * @param nominalUnixSeconds - User-chosen time in Unix seconds
 * @param windowMinutes - Half-width in minutes (e.g. 5 => ±5 min). Must be >= 0.
 * @returns Actual time in Unix seconds to use for scheduling
 */
export function applyRandomScheduleWindow(
  nominalUnixSeconds: number,
  windowMinutes: number
): number {
  if (!Number.isFinite(nominalUnixSeconds) || windowMinutes <= 0) {
    return nominalUnixSeconds;
  }
  const windowSeconds = Math.min(Math.floor(windowMinutes * 60), 24 * 60 * 60);
  const offset =
    Math.floor(Math.random() * (2 * windowSeconds + 1)) - windowSeconds;
  return nominalUnixSeconds + offset;
}
