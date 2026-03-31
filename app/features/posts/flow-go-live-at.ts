import type { CombinedContent } from "./types";

/**
 * Milliseconds for ordering items in Dashboard Flow (past vs future split, sort).
 *
 * For **SCHEDULED** content, `scheduledAtUtc` must win over `publishedAt`. Some rows
 * carry a stale/non-null `publishedAt` from a prior attempt; using `posted || scheduled`
 * misclassifies them as "past" so they vanish from the future strip.
 */
export function getFlowGoLiveAtMs(item: CombinedContent): number {
  const scheduled = item.scheduledAtUtc
    ? new Date(item.scheduledAtUtc).getTime()
    : 0;
  const posted = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;

  if (item.currentState === "SCHEDULED") {
    if (scheduled > 0) return scheduled;
    return posted || 0;
  }

  return posted || scheduled || 0;
}
