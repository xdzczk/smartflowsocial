/**
 * Persisted per-winner payout state for locked giveaways (replaces client sessionStorage).
 */

import {
  simpleUnifiedSatsPerWinner,
  type GiveawayEngagementConfig,
  type GiveawayWinnerEntry,
} from "./types";

export interface GiveawayPayoutAmountContext {
  engagementConfig: unknown;
  winnerCount?: number;
  plannedPayoutSats?: number | null;
}

function plannedPayoutSatsFromEngagementConfig(
  g: GiveawayPayoutAmountContext
): number {
  const unified = simpleUnifiedSatsPerWinner(g.engagementConfig);
  if (unified != null && unified > 0) {
    const wc = typeof g.winnerCount === "number" ? g.winnerCount : 0;
    return Math.max(0, unified * wc);
  }
  const conf = g.engagementConfig as GiveawayEngagementConfig | null;
  if (conf && typeof conf === "object") {
    return Object.values(conf).reduce(
      (acc, c) =>
        acc +
        Math.max(0, Math.floor(c.winnerCount)) *
          Math.max(0, Math.floor(c.satsPerWinner)),
      0
    );
  }
  return 0;
}

/** Resolve sats for one winner (snapshot field, then engagement config). */
export function resolveWinnerSatsPerWinner(
  winner: GiveawayWinnerEntry,
  context: GiveawayPayoutAmountContext
): number {
  const explicit = winner.satsPerWinner;
  if (typeof explicit === "number" && explicit > 0) {
    return Math.floor(explicit);
  }

  const unified = simpleUnifiedSatsPerWinner(context.engagementConfig);
  if (unified != null && unified > 0) return unified;

  const conf = context.engagementConfig as GiveawayEngagementConfig | null;
  if (conf && winner.engagementType) {
    const row = conf[winner.engagementType];
    if (row && row.satsPerWinner > 0) {
      return Math.floor(row.satsPerWinner);
    }
  }

  return 0;
}

/** Planned prize pool from snapshot, row field, or engagement config. */
export function computeGiveawayPlannedPayoutSats(
  g: GiveawayPayoutAmountContext & { winnerSnapshot: unknown }
): number {
  const snapshot = (g.winnerSnapshot as GiveawayWinnerEntry[] | null) ?? [];
  if (snapshot.length > 0) {
    const fromSnapshot = snapshot.reduce(
      (acc, w) => acc + resolveWinnerSatsPerWinner(w, g),
      0
    );
    if (fromSnapshot > 0) return fromSnapshot;
  }
  if (typeof g.plannedPayoutSats === "number" && g.plannedPayoutSats > 0) {
    return g.plannedPayoutSats;
  }
  return plannedPayoutSatsFromEngagementConfig(g);
}

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
  state: GiveawayPayoutStateMap,
  context?: GiveawayPayoutAmountContext
): number {
  return snapshot.reduce((acc, w) => {
    const s = state[w.pubkey]?.status;
    if (s === "sent" || s === "marked_paid") {
      return (
        acc +
        (context
          ? resolveWinnerSatsPerWinner(w, context)
          : (w.satsPerWinner ?? 0))
      );
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
  return computeGiveawayPlannedPayoutSats(g);
}
