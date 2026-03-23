export type ContestPayoutEntryStatus =
  | "pending"
  | "sent"
  | "failed"
  | "marked_paid";

export interface ContestPayoutEntryState {
  status: ContestPayoutEntryStatus;
  updatedAt: string;
  note?: string;
}

export type ContestPayoutState = Record<string, ContestPayoutEntryState>;

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
  const state: ContestPayoutState = {};
  const source =
    payoutState && typeof payoutState === "object"
      ? (payoutState as Record<string, ContestPayoutEntryState>)
      : {};
  for (const pubkey of winnerPubkeys) {
    state[pubkey] =
      source[pubkey] && typeof source[pubkey] === "object"
        ? source[pubkey]
        : { status: "pending", updatedAt: new Date().toISOString() };
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
