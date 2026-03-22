import type { PlanType } from "~/features/payments/types";
import { getBroadcastPlanLimits } from "~/features/payments/types";

/** Heuristic: very short repeated lines (spam-like). */
export function looksSpammyMessage(body: string): boolean {
  const t = body.trim();
  if (t.length < 20) return false;
  const words = t.toLowerCase().split(/\s+/);
  if (words.length < 6) return false;
  const counts = new Map<string, number>();
  for (const w of words) {
    if (w.length < 4) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  for (const c of counts.values()) {
    if (c >= 5) return true;
  }
  return false;
}

export function largeAudienceWarningThreshold(planType: PlanType): number {
  const lim = getBroadcastPlanLimits(planType);
  return Math.max(50, Math.floor(lim.maxRecipientsPerCampaign * 0.5));
}

export function shouldPauseForFailureRate(input: {
  attempted: number;
  failed: number;
  thresholdPercent: number;
}): boolean {
  if (input.attempted < 10) return false;
  const rate = (input.failed / input.attempted) * 100;
  return rate >= input.thresholdPercent;
}
