/**
 * Persisted per-winner payout state for locked giveaways (replaces client sessionStorage).
 */

import {
  isSimpleUnifiedEngagementConfig,
  type GiveawayEngagementConfig,
  type GiveawayWinnerEntry,
} from "./types";

export type GiveawayPayoutEntryStatus =
  | "pending"
  | "sent"
  | "failed"
  | "marked_paid"
  | "claim_needed"
  | "skipped";

export interface GiveawayPayoutEntry {
  status: GiveawayPayoutEntryStatus;
  updatedAt: string;
  note?: string;
}

export type GiveawayPayoutStateMap = Record<string, GiveawayPayoutEntry>;

const VALID: GiveawayPayoutEntryStatus[] = [
  "pending",
  "sent",
  "failed",
  "marked_paid",
  "claim_needed",
  "skipped",
];

export function buildInitialPayoutState(
  snapshot: GiveawayWinnerEntry[]
): GiveawayPayoutStateMap {
  const now = new Date().toISOString();
  const m: GiveawayPayoutStateMap = {};
  for (const w of snapshot) {
    m[w.pubkey] = { status: "pending", updatedAt: now };
  }
  return m;
}

export function normalizePayoutState(
  raw: unknown,
  snapshot: GiveawayWinnerEntry[]
): GiveawayPayoutStateMap {
  const now = new Date().toISOString();
  const out: GiveawayPayoutStateMap = {};
  const stored =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const w of snapshot) {
    const e = stored[w.pubkey];
    if (e && typeof e === "object" && "status" in e) {
      const rec = e as Record<string, unknown>;
      const st = rec["status"];
      if (
        typeof st === "string" &&
        VALID.includes(st as GiveawayPayoutEntryStatus)
      ) {
        const updatedRaw = rec["updatedAt"];
        const noteRaw = rec["note"];
        out[w.pubkey] = {
          status: st as GiveawayPayoutEntryStatus,
          updatedAt: typeof updatedRaw === "string" ? updatedRaw : now,
          note: typeof noteRaw === "string" ? noteRaw : undefined,
        };
        continue;
      }
    }
    out[w.pubkey] = { status: "pending", updatedAt: now };
  }
  return out;
}

export function countPayoutCompleted(
  state: GiveawayPayoutStateMap,
  pubkeys: string[]
): number {
  return pubkeys.filter((pk) => {
    const s = state[pk]?.status;
    return s === "sent" || s === "marked_paid";
  }).length;
}

export function allWinnersPayoutSettled(
  state: GiveawayPayoutStateMap,
  snapshot: GiveawayWinnerEntry[]
): boolean {
  if (snapshot.length === 0) return false;
  return snapshot.every((w) => {
    const s = state[w.pubkey]?.status;
    return s === "sent" || s === "marked_paid";
  });
}

export function totalSatsBudgetFromSnapshot(
  snapshot: GiveawayWinnerEntry[]
): number {
  return snapshot.reduce((acc, w) => acc + (w.satsPerWinner ?? 0), 0);
}

export function totalSatsPaidFromState(
  snapshot: GiveawayWinnerEntry[],
  state: GiveawayPayoutStateMap
): number {
  return snapshot.reduce((acc, w) => {
    const s = state[w.pubkey]?.status;
    if (s === "sent" || s === "marked_paid") {
      return acc + (w.satsPerWinner ?? 0);
    }
    return acc;
  }, 0);
}

/** Budget from locked snapshot, or from engagementConfig for drafts without snapshot. */
export function budgetSatsFromGiveawayRow(g: {
  winnerSnapshot: unknown;
  engagementConfig: unknown;
  winnerCount?: number;
  plannedPayoutSats?: number | null;
}): number {
  const snapshot = (g.winnerSnapshot as GiveawayWinnerEntry[] | null) ?? null;
  if (snapshot && snapshot.length > 0) {
    return totalSatsBudgetFromSnapshot(snapshot);
  }
  if (typeof g.plannedPayoutSats === "number" && g.plannedPayoutSats > 0) {
    return g.plannedPayoutSats;
  }
  if (isSimpleUnifiedEngagementConfig(g.engagementConfig)) {
    const sats = g.engagementConfig._simpleUnified.satsPerWinner;
    const wc = typeof g.winnerCount === "number" ? g.winnerCount : 0;
    return Math.max(0, sats * wc);
  }
  const conf = g.engagementConfig as GiveawayEngagementConfig | null;
  if (conf && typeof conf === "object") {
    return Object.values(conf).reduce(
      (acc, c) => acc + c.winnerCount * c.satsPerWinner,
      0
    );
  }
  return 0;
}
