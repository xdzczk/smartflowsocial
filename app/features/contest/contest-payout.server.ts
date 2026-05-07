export type ContestPayoutEntryStatus =
  | "pending"
  | "sent"
  | "failed"
  | "marked_paid"
  | "claim_needed"
  | "skipped";

export interface ContestPayoutEntryState {
  status: ContestPayoutEntryStatus;
  updatedAt: string;
  note?: string;
}

export type ContestPayoutState = Record<string, ContestPayoutEntryState>;

const VALID: ContestPayoutEntryStatus[] = [
  "pending",
  "sent",
  "failed",
  "marked_paid",
  "claim_needed",
  "skipped",
];

export function buildInitialContestPayoutState(
  pubkeys: string[]
): ContestPayoutState {
  const now = new Date().toISOString();
  return pubkeys.reduce<ContestPayoutState>((acc, key) => {
    acc[key] = { status: "pending", updatedAt: now };
    return acc;
  }, {});
}

export function normalizeContestPayoutState(
  payoutState: unknown,
  winnerPubkeys: string[]
): ContestPayoutState {
  const now = new Date().toISOString();
  const state: ContestPayoutState = {};
  const source =
    payoutState && typeof payoutState === "object"
      ? (payoutState as Record<string, unknown>)
      : {};
  for (const pubkey of winnerPubkeys) {
    const e = source[pubkey];
    if (e && typeof e === "object" && "status" in e) {
      const rec = e as Record<string, unknown>;
      const st = rec["status"];
      if (
        typeof st === "string" &&
        VALID.includes(st as ContestPayoutEntryStatus)
      ) {
        const updatedRaw = rec["updatedAt"];
        const noteRaw = rec["note"];
        state[pubkey] = {
          status: st as ContestPayoutEntryStatus,
          updatedAt: typeof updatedRaw === "string" ? updatedRaw : now,
          note: typeof noteRaw === "string" ? noteRaw : undefined,
        };
        continue;
      }
    }
    state[pubkey] = { status: "pending", updatedAt: now };
  }
  return state;
}

export function allContestWinnersSettled(
  state: ContestPayoutState,
  winnerPubkeys: string[]
): boolean {
  return winnerPubkeys.every((pubkey) => {
    const s = state[pubkey]?.status;
    return s === "sent" || s === "marked_paid";
  });
}
