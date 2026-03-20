/**
 * Loader/action tests for app/routes/dashboard.admin._index.tsx
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { describe, it, expect, vi, beforeEach } from "vitest";

const envState = vi.hoisted(() => ({
  NODE_ENV: "test",
  OWNER_NWC: "nostr+walletconnect://mock",
}));

vi.mock("~/lib/env.server", () => ({
  get env() {
    return {
      NODE_ENV: envState.NODE_ENV,
      OWNER_NWC: envState.OWNER_NWC,
    };
  },
}));

const mockRequireUser = vi.fn();
const mockIsReferralAdmin = vi.fn();
const mockGetAdminOverviewStats = vi.fn();
const mockRunReferralPayoutBatch = vi.fn();
const mockPayReferrerWithInvoice = vi.fn();

vi.mock("~/features/auth", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

vi.mock("~/features/referral/referral-admin.server", () => ({
  isReferralAdmin: (...args: unknown[]) => mockIsReferralAdmin(...args),
}));

vi.mock(
  "~/features/admin/repositories/admin-overview-stats-data.server",
  () => ({
    getAdminOverviewStats: (...args: unknown[]) =>
      mockGetAdminOverviewStats(...args),
  })
);

vi.mock("~/features/referral/referral-payout.server", () => ({
  runReferralPayoutBatch: (...args: unknown[]) =>
    mockRunReferralPayoutBatch(...args),
  payReferrerWithInvoice: (...args: unknown[]) =>
    mockPayReferrerWithInvoice(...args),
}));

import { loader, action } from "~/routes/dashboard.admin._index";

const emptyStats = {
  usersTotal: 0,
  usersEnabled: 0,
  subscriptionsActive: 0,
  postsByCurrentState: [] as Array<{ currentState: string; count: number }>,
  longFormByCurrentState: [] as Array<{ currentState: string; count: number }>,
  referralLinkCount: 0,
  referralEarningsByStatus: { pending: 0, paid: 0, failed: 0 },
  referralPendingCommissionSats: 0,
  referralPayoutEligibleCount: 0,
  referralPayoutEligiblePreviewNpubs: [] as string[],
};

describe("dashboard.admin._index loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.OWNER_NWC = "nostr+walletconnect://mock";
    mockRequireUser.mockResolvedValue({ npub: "npub_admin" });
    mockIsReferralAdmin.mockReturnValue(true);
    mockGetAdminOverviewStats.mockResolvedValue(emptyStats);
  });

  it("returns 403 when user is not referral admin", async () => {
    mockIsReferralAdmin.mockReturnValue(false);
    const args: LoaderFunctionArgs = {
      request: new Request("http://localhost/dashboard/admin"),
      params: {},
      context: {},
    };
    const res = await loader(args);
    expect(res.status).toBe(403);
  });

  it("returns stats and payoutAvailable when admin", async () => {
    const args: LoaderFunctionArgs = {
      request: new Request("http://localhost/dashboard/admin"),
      params: {},
      context: {},
    };
    const res = await loader(args);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      stats: emptyStats,
      payoutAvailable: true,
    });
  });
});

describe("dashboard.admin._index action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.OWNER_NWC = "nostr+walletconnect://mock";
    mockRequireUser.mockResolvedValue({ npub: "npub_admin" });
    mockIsReferralAdmin.mockReturnValue(true);
    mockRunReferralPayoutBatch.mockResolvedValue({
      processed: 1,
      paid: 1,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    });
    mockPayReferrerWithInvoice.mockResolvedValue({ success: true });
  });

  it("returns 403 when not admin", async () => {
    mockIsReferralAdmin.mockReturnValue(false);
    const body = new FormData();
    body.set("_action", "run_batch_payout");
    body.set("confirm_batch", "on");
    const args: ActionFunctionArgs = {
      request: new Request("http://localhost/dashboard/admin", {
        method: "POST",
        body,
      }),
      params: {},
      context: {},
    };
    const res = await action(args);
    expect(res.status).toBe(403);
  });

  it("returns 400 when OWNER_NWC missing", async () => {
    envState.OWNER_NWC = "";
    const body = new FormData();
    body.set("_action", "run_batch_payout");
    body.set("confirm_batch", "on");
    const args: ActionFunctionArgs = {
      request: new Request("http://localhost/dashboard/admin", {
        method: "POST",
        body,
      }),
      params: {},
      context: {},
    };
    const res = await action(args);
    expect(res.status).toBe(400);
  });

  it("returns 400 when batch confirm not checked", async () => {
    const body = new FormData();
    body.set("_action", "run_batch_payout");
    const args: ActionFunctionArgs = {
      request: new Request("http://localhost/dashboard/admin", {
        method: "POST",
        body,
      }),
      params: {},
      context: {},
    };
    const res = await action(args);
    expect(res.status).toBe(400);
  });

  it("runs batch payout and returns summary", async () => {
    const body = new FormData();
    body.set("_action", "run_batch_payout");
    body.set("confirm_batch", "on");
    const args: ActionFunctionArgs = {
      request: new Request("http://localhost/dashboard/admin", {
        method: "POST",
        body,
      }),
      params: {},
      context: {},
    };
    const res = await action(args);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      batch: { paid: 1 },
    });
    expect(mockRunReferralPayoutBatch).toHaveBeenCalledOnce();
  });

  it("manual payout calls payReferrerWithInvoice", async () => {
    const body = new FormData();
    body.set("_action", "manual_payout");
    body.set("referrer_npub", "npub1test");
    body.set("bolt11", "lnbc1fake");
    body.set("amount_sats", "100");
    const args: ActionFunctionArgs = {
      request: new Request("http://localhost/dashboard/admin", {
        method: "POST",
        body,
      }),
      params: {},
      context: {},
    };
    const res = await action(args);
    expect(res.status).toBe(200);
    expect(mockPayReferrerWithInvoice).toHaveBeenCalledWith(
      "npub1test",
      "lnbc1fake",
      100
    );
  });
});
