import { BRAND_NAME } from "~/lib/brand";

export const payoutCopy = {
  trustNote: "Non-custodial · paid from your wallet",
  lockTrustNote: `Prize funds stay in your wallet. ${BRAND_NAME} never holds prize funds.`,
  payoutMethod: "Payout method",
  autoPayAfterLock: "Auto-pay after lock",
  autoPayAtEnd: "Auto-pay at end",
  autoPayCap: "Auto-pay cap",
  payWinnersNow: "Pay winners now",
  markPaidManually: "Mark paid manually",
  markFailed: "Mark failed",
  needsReview: "Needs review",
  paidViaWallet: "Paid via wallet",
  paidManually: "Paid manually",
  pending: "Pending",
  paying: "Paying",
  failed: "Failed",
  skipped: "Skipped",
  resolve: "Resolve",
  retry: "Retry",
  switchToManualFallback: "Switch to manual fallback",
} as const;
