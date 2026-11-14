export interface ProductionSecretInput {
  nodeEnv: string | undefined;
  e2eTest: string | undefined;
  cronSecret: string | undefined;
  referralManualPayoutSecret: string | undefined;
  /** When "true", production also requires the referral payout secret. */
  referralPayoutsEnabled: string | undefined;
  nostrPublisherApiToken: string | undefined;
  nostrPublisherAllowUnauthenticated: string | undefined;
}

export interface ProductionSecretProblem {
  key: string;
  reason: string;
}

/**
 * Production boot refuses to start when secrets that gate administrative HTTP
 * routes are missing. Referral payouts are optional: the manual route stays
 * closed until its secret is set, and production requires that secret only
 * when `REFERRAL_PAYOUTS_ENABLED=true`. Development and E2E boots may omit
 * the cron and publisher secrets; those routes still reject requests.
 */
export function productionSecretErrors(
  input: ProductionSecretInput
): ProductionSecretProblem[] {
  if (input.nodeEnv !== "production" || input.e2eTest === "true") return [];

  const problems: ProductionSecretProblem[] = [];
  if ((input.cronSecret?.trim() ?? "").length < 32) {
    problems.push({
      key: "CRON_SECRET",
      reason:
        "is required in production and must be at least 32 characters. Generate one with: openssl rand -base64 32",
    });
  }
  if (
    input.referralPayoutsEnabled === "true" &&
    (input.referralManualPayoutSecret?.trim() ?? "").length < 32
  ) {
    problems.push({
      key: "REFERRAL_MANUAL_PAYOUT_SECRET",
      reason:
        "is required in production when REFERRAL_PAYOUTS_ENABLED=true and must be at least 32 characters. Generate one with: openssl rand -base64 32",
    });
  }
  const allowPublicPublisher =
    input.nostrPublisherAllowUnauthenticated === "true";
  if (
    !allowPublicPublisher &&
    (input.nostrPublisherApiToken?.trim() ?? "").length < 16
  ) {
    problems.push({
      key: "NOSTR_PUBLISHER_API_TOKEN",
      reason:
        "is required in production unless public publishing is explicitly enabled. Use at least 16 characters, matching the publisher API_TOKEN.",
    });
  }
  return problems;
}
