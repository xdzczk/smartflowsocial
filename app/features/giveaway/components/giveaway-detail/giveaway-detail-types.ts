export interface WinnerProfileDisplay {
  displayName: string | null;
  picture: string | null;
}

export interface GiveawayPayoutProgress {
  settledCount: number;
  totalWinners: number;
  budgetSats: number;
  settledSats: number;
}
