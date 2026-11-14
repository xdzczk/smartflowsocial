export interface ProductionSecretInput {
  nodeEnv: string | undefined;
  e2eTest: string | undefined;
  cronSecret: string | undefined;
  referralManualPayoutSecret: string | undefined;
  nostrPublisherApiToken: string | undefined;
  nostrPublisherAllowUnauthenticated: string | undefined;
}

export interface ProductionSecretProblem {
  key: string;
  reason: string;
}

/**
 * Production boot refuses to start when secrets that gate financial or
 * administrative HTTP routes are missing. Development and E2E boots may omit
 * them; those routes still reject requests until the secret is set.
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
  if ((input.referralManualPayoutSecret?.trim() ?? "").length < 32) {
    problems.push({
      key: "REFERRAL_MANUAL_PAYOUT_SECRET",
      reason:
        "is required in production and must be at least 32 characters. Generate one with: openssl rand -base64 32",
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
