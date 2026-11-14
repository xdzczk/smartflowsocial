import { describe, expect, it } from "vitest";

import { productionSecretErrors } from "~/lib/production-secrets.server";

const base = {
  nodeEnv: "production",
  e2eTest: undefined,
  cronSecret: undefined,
  referralManualPayoutSecret: undefined,
  nostrPublisherApiToken: undefined,
  nostrPublisherAllowUnauthenticated: undefined,
};

describe("production secret validation", () => {
  it("requires cron, referral, and publisher secrets in production", () => {
    const problems = productionSecretErrors(base);
    expect(problems.map((problem) => problem.key)).toEqual([
      "CRON_SECRET",
      "REFERRAL_MANUAL_PAYOUT_SECRET",
      "NOSTR_PUBLISHER_API_TOKEN",
    ]);
  });

  it("accepts long secrets", () => {
    const problems = productionSecretErrors({
      ...base,
      cronSecret: "c".repeat(32),
      referralManualPayoutSecret: "r".repeat(32),
      nostrPublisherApiToken: "p".repeat(16),
    });
    expect(problems).toEqual([]);
  });

  it("skips the check outside production and during e2e", () => {
    expect(productionSecretErrors({ ...base, nodeEnv: "development" })).toEqual(
      []
    );
    expect(productionSecretErrors({ ...base, e2eTest: "true" })).toEqual([]);
  });

  it("allows a public publisher only when that mode is explicit", () => {
    const problems = productionSecretErrors({
      ...base,
      cronSecret: "c".repeat(32),
      referralManualPayoutSecret: "r".repeat(32),
      nostrPublisherAllowUnauthenticated: "true",
    });
    expect(problems).toEqual([]);
  });
});
