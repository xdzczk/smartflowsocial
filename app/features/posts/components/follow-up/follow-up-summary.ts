import type { RepostConditions } from "~/features/posts/types";

/** Counts how many repost condition thresholds are set (for collapsed summary). */
export function countRepostConditionRules(
  conditions: RepostConditions | null | undefined
): number {
  if (!conditions) return 0;
  let n = 0;
  if (conditions.minReactions != null) n++;
  if (conditions.minZaps != null) n++;
  if (conditions.minComments != null) n++;
  if (conditions.minReposts != null) n++;
  if (conditions.minSats != null) n++;
  return n;
}

/** Collapsed Follow-up row + options line fragments (concise, no prose). */
export function buildFollowUpCollapsedSummary(input: {
  repostCount: number;
  quoteCount: number;
  conditionRuleCount: number;
}): string {
  const { repostCount, quoteCount, conditionRuleCount } = input;
  if (repostCount === 0 && quoteCount === 0) return "None";
  const parts: string[] = [];
  if (repostCount > 0) {
    let s = `Repost (${repostCount})`;
    if (conditionRuleCount > 0) {
      s += " · Conditions";
    }
    parts.push(s);
  }
  if (quoteCount > 0) {
    parts.push(`Quote (${quoteCount})`);
  }
  return parts.join(" · ");
}
