import { describe, expect, it } from "vitest";

import { productionSecretErrors } from "~/lib/production-secrets.server";

const base = {
  nodeEnv: "production",
  e2eTest: undefined,
  cronSecret: undefined,
  referralManualPayoutSecret: undefined,
  referralPayoutsEnabled: undefined,
  nostrPublisherApiToken: undefined,
  nostrPublisherAllowUnauthenticated: undefined,
};

describe("production secret validation", () => {
  it("requires cron and publisher secrets, and leaves referral payouts optional", () => {
    const problems = productionSecretErrors(base);
    expect(problems.map((problem) => problem.key)).toEqual([
      "CRON_SECRET",
      "NOSTR_PUBLISHER_API_TOKEN",
    ]);
  });

  it("requires the referral secret only when payouts are enabled", () => {
    const problems = productionSecretErrors({
      ...base,
      referralPayoutsEnabled: "true",
    });
    expect(problems.map((problem) => problem.key)).toContain(
      "REFERRAL_MANUAL_PAYOUT_SECRET"
    );

    const disabled = productionSecretErrors({
      ...base,
      cronSecret: "c".repeat(32),
      nostrPublisherApiToken: "p".repeat(16),
      referralPayoutsEnabled: "false",
    });
    expect(disabled).toEqual([]);
  });

  it("accepts long secrets", () => {
    const problems = productionSecretErrors({
      ...base,
      cronSecret: "c".repeat(32),
      referralPayoutsEnabled: "true",
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
      nostrPublisherAllowUnauthenticated: "true",
    });
    expect(problems).toEqual([]);
  });
});
