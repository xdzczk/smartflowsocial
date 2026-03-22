/**
 * Action tests for referral payouts on dashboard.admin.referrals.
 */

import type { ActionFunctionArgs } from "@remix-run/node";
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

vi.mock("~/lib/csrf", () => ({
  withCSRFProtection: (fn: (args: ActionFunctionArgs) => Promise<unknown>) =>
    fn,
}));

const mockRequireUser = vi.fn();
const mockIsReferralAdmin = vi.fn();
const mockRunReferralPayoutBatch = vi.fn();
const mockPayReferrerWithInvoice = vi.fn();

vi.mock("~/features/auth", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

vi.mock("~/features/referral/referral-payout-audit.server", () => ({
  listReferralPayoutAuditLogs: vi.fn().mockResolvedValue([]),
  createReferralPayoutAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock(
  "~/features/admin/repositories/admin-overview-stats-data.server",
  () => ({
    getAdminOverviewStats: vi.fn().mockResolvedValue({
      usersTotal: 0,
      usersEnabled: 0,
      subscriptionsActivePaid: 0,
      subscriptionsActiveAll: 0,
      postsByCurrentState: [],
      longFormByCurrentState: [],
      referralLinkCount: 0,
      referralEarningsByStatus: { pending: 0, paid: 0, failed: 0 },
      referralPendingCommissionSats: 0,
      referralPayoutEligibleCount: 0,
      referralPayoutEligiblePreviewNpubs: [],
    }),
  })
);

vi.mock("~/features/referral/referral-admin.server", () => ({
  isReferralAdmin: (...args: unknown[]) => mockIsReferralAdmin(...args),
  getReferralsAdmin: vi.fn().mockResolvedValue({
    referrals: [],
    total: 0,
    page: 1,
    pageSize: 50,
  }),
  getEarningsAdmin: vi.fn().mockResolvedValue({
    earnings: [],
    total: 0,
    page: 1,
    pageSize: 50,
  }),
  referralsToCsv: vi.fn(),
  earningsToCsv: vi.fn(),
  retryFailedPayout: vi.fn(),
}));

vi.mock("~/features/referral/referral-payout.server", () => ({
  runReferralPayoutBatch: (...args: unknown[]) =>
    mockRunReferralPayoutBatch(...args),
  payReferrerWithInvoice: (...args: unknown[]) =>
    mockPayReferrerWithInvoice(...args),
}));

import { action } from "~/routes/dashboard.admin.referrals.server";

describe("dashboard.admin.referrals action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.OWNER_NWC = "nostr+walletconnect://mock";
    mockRequireUser.mockResolvedValue({ npub: "npub_admin_hex" });
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
      request: new Request("http://localhost/dashboard/admin/referrals", {
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
      request: new Request("http://localhost/dashboard/admin/referrals", {
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
      request: new Request("http://localhost/dashboard/admin/referrals", {
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
    body.set("confirm_phrase", "PAY");
    const args: ActionFunctionArgs = {
      request: new Request("http://localhost/dashboard/admin/referrals", {
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
    expect(mockRunReferralPayoutBatch).toHaveBeenCalledWith({
      operatorNpub: "npub_admin_hex",
    });
  });

  it("manual payout calls payReferrerWithInvoice with audit", async () => {
    const body = new FormData();
    body.set("_action", "manual_payout");
    body.set("referrer_npub", "npub1test");
    body.set("bolt11", "lnbc1fake");
    body.set("amount_sats", "100");
    const args: ActionFunctionArgs = {
      request: new Request("http://localhost/dashboard/admin/referrals", {
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
      100,
      { channel: "manual", operatorNpub: "npub_admin_hex" }
    );
  });
});
