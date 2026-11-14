import { beforeEach, describe, expect, it, vi } from "vitest";

const jobs = vi.hoisted(() => ({
  campaign: vi.fn(async () => ({ ran: true })),
  subscriptions: vi.fn(async () => ({ success: true })),
  cleanup: vi.fn(async () => ({ deleted: 1 })),
  referral: vi.fn(async () => ({
    processed: 0,
    paid: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  })),
  analytics: vi.fn(async () => ({ notes: 0 })),
}));

const envState = vi.hoisted(() => ({
  CRON_SECRET: undefined as string | undefined,
  REFERRAL_PAYOUTS_ENABLED: undefined as string | undefined,
}));

vi.mock("~/lib/env.server", () => ({
  get env() {
    return envState;
  },
}));

vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
}));

vi.mock("~/lib/websocket-polyfill.server", () => ({
  ensureServerWebSocket: () => undefined,
}));

vi.mock("~/features/payments", () => ({
  runCampaignPayoutAutorunCron: () => jobs.campaign(),
  checkAndRenewSubscriptions: () => jobs.subscriptions(),
}));

vi.mock("~/features/relays/publish-relay-ack-retention.server", () => ({
  cleanupPublishRelayAcks: () => jobs.cleanup(),
}));

vi.mock("~/features/referral/referral-payout.server", () => ({
  runReferralPayoutBatch: () => jobs.referral(),
  referralPayoutsEnabled: (flag?: string) =>
    (flag ?? envState.REFERRAL_PAYOUTS_ENABLED) !== "false",
}));

vi.mock("~/features/analytics/run-sweep.server", () => ({
  runPaidPostAnalyticsSweep: () => jobs.analytics(),
}));

const SECRET = "cron-test-secret";

function request(path: string, method: string, secret?: string): Request {
  const headers = new Headers();
  if (secret) headers.set("x-cron-secret", secret);
  return new Request(`http://localhost${path}`, { method, headers });
}

describe("cron route authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.CRON_SECRET = undefined;
    envState.REFERRAL_PAYOUTS_ENABLED = undefined;
  });

  it("does not run referral payouts when the feature is disabled", async () => {
    envState.CRON_SECRET = SECRET;
    envState.REFERRAL_PAYOUTS_ENABLED = "false";
    const route = await import("~/routes/cron.referral-payout");
    const response = await route.action({
      request: request("/cron/referral-payout", "POST", SECRET),
      params: {},
      context: {},
    });
    expect(response.status).toBe(403);
    expect(jobs.referral).not.toHaveBeenCalled();
  });

  const cases = [
    {
      name: "campaign payout",
      path: "/cron/campaign-payout",
      load: () => import("~/routes/cron.campaign-payout"),
      job: jobs.campaign,
    },
    {
      name: "referral payout",
      path: "/cron/referral-payout",
      load: () => import("~/routes/cron.referral-payout"),
      job: jobs.referral,
    },
    {
      name: "cleanup",
      path: "/cron/cleanup-publish-acks",
      load: () => import("~/routes/cron.cleanup-publish-acks"),
      job: jobs.cleanup,
    },
    {
      name: "subscription renewal",
      path: "/cron/checksubscription",
      load: () => import("~/routes/cron.checksubscription"),
      job: jobs.subscriptions,
    },
    {
      name: "post analytics",
      path: "/cron/post-analytics",
      load: () => import("~/routes/cron.post-analytics"),
      job: jobs.analytics,
    },
  ] as const;

  it.each(cases)(
    "$name rejects a missing secret",
    async ({ path, load, job }) => {
      const route = await load();
      const response = await route.action({
        request: request(path, "POST"),
        params: {},
        context: {},
      });
      expect(response.status).toBe(401);
      expect(job).not.toHaveBeenCalled();
    }
  );

  it.each(cases)(
    "$name rejects an invalid secret",
    async ({ path, load, job }) => {
      envState.CRON_SECRET = SECRET;
      const route = await load();
      const response = await route.action({
        request: request(path, "POST", "wrong-secret"),
        params: {},
        context: {},
      });
      expect(response.status).toBe(401);
      expect(job).not.toHaveBeenCalled();
    }
  );

  it.each(cases)(
    "$name runs for a valid secret on POST and GET",
    async ({ path, load, job }) => {
      envState.CRON_SECRET = SECRET;
      const route = await load();
      const posted = await route.action({
        request: request(path, "POST", SECRET),
        params: {},
        context: {},
      });
      const gotten = await route.loader({
        request: request(path, "GET", SECRET),
        params: {},
        context: {},
      });
      expect(posted.status).toBe(200);
      expect(gotten.status).toBe(200);
      expect(job).toHaveBeenCalledTimes(2);
    }
  );
});
